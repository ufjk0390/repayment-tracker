import prisma from '../lib/prisma.js';

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'AUTH_NOT_AUTHENTICATED',
          message: 'Authentication required',
        },
      });
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'AUTH_FORBIDDEN',
          message: 'You do not have permission to perform this action',
        },
      });
    }

    next();
  };
}

export async function getPairedUserId(req) {
  if (req.user.role === 'USER') {
    return req.user.id;
  }

  if (req.user.role === 'SUPERVISOR') {
    const pairing = await prisma.pairing.findUnique({
      where: { supervisorId: req.user.id, status: 'ACTIVE' },
    });

    if (!pairing) {
      return null;
    }

    return pairing.userId;
  }

  return null;
}

export async function requirePairing(req, res, next) {
  const pairing = await prisma.pairing.findFirst({
    where: {
      OR: [
        { supervisorId: req.user.id, status: 'ACTIVE' },
        { userId: req.user.id, status: 'ACTIVE' },
      ],
    },
  });

  if (!pairing) {
    return res.status(400).json({
      error: {
        code: 'PAIRING_NOT_FOUND',
        message: 'An active pairing is required for this action',
      },
    });
  }

  req.pairing = pairing;
  next();
}
