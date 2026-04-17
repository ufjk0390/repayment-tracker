import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { createNotification } from './notification.controller.js';

function generateInviteCode() {
  // C-05/L-01: Use crypto.randomBytes for security
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(bytes[i] % chars.length);
  }
  return code;
}

export async function invite(req, res, next) {
  try {
    if (req.user.role !== 'SUPERVISOR') {
      return res.status(403).json({
        error: {
          code: 'PAIRING_NOT_SUPERVISOR',
          message: '此操作僅限監督人。當事人無法產生邀請碼',
        },
      });
    }

    const existingPairing = await prisma.pairing.findUnique({
      where: { supervisorId: req.user.id },
    });

    if (existingPairing && existingPairing.status !== 'DISSOLVED') {
      return res.status(400).json({
        error: {
          code: 'PAIRING_ALREADY_EXISTS',
          message: 'You already have an active or pending pairing',
        },
      });
    }

    // If dissolved, delete the old pairing to allow new one
    if (existingPairing && existingPairing.status === 'DISSOLVED') {
      await prisma.pairing.delete({ where: { id: existingPairing.id } });
    }

    const inviteCode = generateInviteCode();

    const pairing = await prisma.pairing.create({
      data: {
        supervisorId: req.user.id,
        inviteCode,
        status: 'PENDING',
      },
    });

    res.status(201).json({
      data: {
        inviteCode: pairing.inviteCode,
        expiresAt: new Date(pairing.createdAt.getTime() + 24 * 60 * 60 * 1000),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function join(req, res, next) {
  try {
    if (req.user.role !== 'USER') {
      return res.status(403).json({
        error: {
          code: 'PAIRING_NOT_USER',
          message: '此操作僅限當事人。監督人無法輸入邀請碼配對',
        },
      });
    }

    const existingPairing = await prisma.pairing.findFirst({
      where: { userId: req.user.id, status: { not: 'DISSOLVED' } },
    });

    if (existingPairing) {
      return res.status(400).json({
        error: {
          code: 'PAIRING_ALREADY_PAIRED',
          message: 'You are already paired',
        },
      });
    }

    const { inviteCode } = req.body;
    if (!inviteCode) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invite code is required',
        },
      });
    }

    const pairing = await prisma.pairing.findUnique({
      where: { inviteCode },
    });

    if (!pairing || pairing.status !== 'PENDING') {
      return res.status(404).json({
        error: {
          code: 'PAIRING_INVITE_NOT_FOUND',
          message: 'Invalid or expired invite code',
        },
      });
    }

    // Check 24hr expiry
    const expiresAt = new Date(pairing.createdAt.getTime() + 24 * 60 * 60 * 1000);
    if (new Date() > expiresAt) {
      return res.status(400).json({
        error: {
          code: 'PAIRING_INVITE_EXPIRED',
          message: 'This invite code has expired',
        },
      });
    }

    const updatedPairing = await prisma.pairing.update({
      where: { id: pairing.id },
      data: {
        userId: req.user.id,
        status: 'ACTIVE',
        pairedAt: new Date(),
      },
      include: {
        supervisor: { select: { id: true, name: true, email: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await createNotification(
      pairing.supervisorId,
      'PAIRING_JOINED',
      '配對成功',
      `使用者 ${req.user.name} 已加入您的配對`,
      'Pairing',
      pairing.id
    );

    res.json({ data: updatedPairing });
  } catch (err) {
    next(err);
  }
}

export async function getStatus(req, res, next) {
  try {
    const pairing = await prisma.pairing.findFirst({
      where: {
        OR: [
          { supervisorId: req.user.id },
          { userId: req.user.id },
        ],
        status: { not: 'DISSOLVED' },
      },
      include: {
        supervisor: { select: { id: true, name: true, email: true, phone: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!pairing) {
      return res.json({ data: null });
    }

    // Compute expiry for PENDING invites (24hr from createdAt)
    const expiresAt = new Date(pairing.createdAt.getTime() + 24 * 60 * 60 * 1000);

    res.json({
      data: {
        ...pairing,
        expiresAt,
        expired: pairing.status === 'PENDING' && new Date() > expiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function dissolve(req, res, next) {
  try {
    const pairing = await prisma.pairing.findFirst({
      where: {
        OR: [
          { supervisorId: req.user.id },
          { userId: req.user.id },
        ],
        status: 'ACTIVE',
      },
    });

    if (!pairing) {
      return res.status(404).json({
        error: {
          code: 'PAIRING_NOT_FOUND',
          message: 'No active pairing found',
        },
      });
    }

    const updated = await prisma.pairing.update({
      where: { id: pairing.id },
      data: {
        status: 'DISSOLVED',
        dissolvedAt: new Date(),
      },
    });

    // Notify the other party
    const recipientId =
      req.user.id === pairing.supervisorId ? pairing.userId : pairing.supervisorId;

    await createNotification(
      recipientId,
      'PAIRING_DISSOLVED',
      '配對已解除',
      `您的配對已被解除`,
      'Pairing',
      pairing.id
    );

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}
