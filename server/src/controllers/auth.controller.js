import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

function sanitizeUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function register(req, res, next) {
  try {
    const { email, password, name, role, phone, monthlyIncome, monthlyFixedExp } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        error: {
          code: 'AUTH_EMAIL_EXISTS',
          message: 'An account with this email already exists',
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role,
        phone,
        monthlyIncome,
        monthlyFixedExp,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_REGISTERED',
        targetType: 'User',
        targetId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.status(201).json({ data: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Check account lockout (M3)
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      return res.status(429).json({
        error: {
          code: 'AUTH_ACCOUNT_LOCKED',
          message: `Account locked. Try again after ${user.lockoutUntil.toISOString()}`,
        },
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      // Increment failed attempts
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const updateData = { failedLoginAttempts: attempts };
      if (attempts >= 5) {
        updateData.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min
        updateData.failedLoginAttempts = 0;
      }
      await prisma.user.update({ where: { id: user.id }, data: updateData });

      return res.status(401).json({
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockoutUntil: null },
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        targetType: 'User',
        targetId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      data: {
        accessToken,
        user: sanitizeUser(user),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({
        error: {
          code: 'AUTH_REFRESH_TOKEN_MISSING',
          message: 'Refresh token is required',
        },
      });
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!storedToken) {
      return res.status(401).json({
        error: {
          code: 'AUTH_REFRESH_TOKEN_INVALID',
          message: 'Invalid refresh token',
        },
      });
    }

    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      return res.status(401).json({
        error: {
          code: 'AUTH_REFRESH_TOKEN_EXPIRED',
          message: 'Refresh token has expired',
        },
      });
    }

    const accessToken = generateAccessToken(storedToken.user);

    res.json({
      data: { accessToken },
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }

    res.clearCookie('refreshToken', { path: '/' });

    res.json({ data: { message: 'Logged out successfully' } });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to avoid email enumeration
    if (!user) {
      return res.json({ data: { message: 'If the account exists, a reset link has been sent' } });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiresAt: expiresAt },
    });

    // In production: send email with reset link
    // For development: return token in response (REMOVE in production)
    res.json({
      data: {
        message: 'If the account exists, a reset link has been sent',
        ...(process.env.NODE_ENV === 'development' && { devToken: resetToken }),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { resetToken: token } });
    if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      return res.status(400).json({
        error: { code: 'AUTH_RESET_TOKEN_INVALID', message: 'Invalid or expired reset token' },
      });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        resetToken: null,
        resetTokenExpiresAt: null,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    // Invalidate all existing sessions
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    res.json({ data: { message: 'Password reset successfully' } });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const { name, phone, monthlyIncome, monthlyFixedExp } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (monthlyIncome !== undefined) data.monthlyIncome = monthlyIncome;
    if (monthlyFixedExp !== undefined) data.monthlyFixedExp = monthlyFixedExp;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PROFILE_UPDATED',
        targetType: 'User',
        targetId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({ data: sanitizeUser(updated) });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Current password is incorrect' },
      });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: newHash },
    });

    // Invalidate all refresh tokens (force re-login on other devices)
    await prisma.refreshToken.deleteMany({ where: { userId: req.user.id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PASSWORD_CHANGED',
        targetType: 'User',
        targetId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({ data: { message: 'Password changed successfully' } });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    res.json({ data: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}
