import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Access token is required',
      },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          code: 'AUTH_TOKEN_EXPIRED',
          message: 'Access token has expired',
        },
      });
    }
    return res.status(401).json({
      error: {
        code: 'AUTH_TOKEN_INVALID',
        message: 'Invalid access token',
      },
    });
  }
}
