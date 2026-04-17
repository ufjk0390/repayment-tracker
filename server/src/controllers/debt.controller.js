import prisma from '../lib/prisma.js';
import { getPairedUserId } from '../middleware/authorize.js';

export async function list(req, res, next) {
  try {
    const targetUserId = await getPairedUserId(req);
    if (!targetUserId) {
      return res.status(400).json({
        error: {
          code: 'PAIRING_NOT_FOUND',
          message: 'No active pairing found',
        },
      });
    }

    const { status } = req.query;
    const where = { userId: targetUserId, isDeleted: false };
    if (status) where.status = status;

    const debts = await prisma.debt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: debts });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    if (req.user.role !== 'USER') {
      return res.status(403).json({
        error: {
          code: 'AUTH_FORBIDDEN',
          message: '此操作僅限當事人。監督人無法新增債務',
        },
      });
    }

    const { name, creditor, originalAmount, monthlyDue, dueDay, note } = req.body;

    const debt = await prisma.debt.create({
      data: {
        userId: req.user.id,
        name,
        creditor,
        originalAmount,
        currentBalance: originalAmount,
        monthlyDue,
        dueDay,
        note,
      },
    });

    res.status(201).json({ data: debt });
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const targetUserId = await getPairedUserId(req);

    const debt = await prisma.debt.findFirst({
      where: { id, userId: targetUserId, isDeleted: false },
    });

    if (!debt) {
      return res.status(404).json({
        error: {
          code: 'DEBT_NOT_FOUND',
          message: 'Debt not found',
        },
      });
    }

    // Include payment history
    const payments = await prisma.transaction.findMany({
      where: {
        debtId: id,
        type: 'REPAYMENT',
        status: 'APPROVED',
      },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        amount: true,
        description: true,
        createdAt: true,
      },
    });

    res.json({
      data: {
        ...debt,
        payments,
        totalPaid: debt.originalAmount - debt.currentBalance,
        progressPercent:
          debt.originalAmount > 0
            ? Math.round(((debt.originalAmount - debt.currentBalance) / debt.originalAmount) * 100)
            : 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    if (req.user.role !== 'USER') {
      return res.status(403).json({
        error: {
          code: 'AUTH_FORBIDDEN',
          message: '此操作僅限當事人。監督人無法編輯債務',
        },
      });
    }

    const { id } = req.params;

    const debt = await prisma.debt.findFirst({
      where: { id, userId: req.user.id, isDeleted: false },
    });

    if (!debt) {
      return res.status(404).json({
        error: {
          code: 'DEBT_NOT_FOUND',
          message: 'Debt not found',
        },
      });
    }

    if (debt.status !== 'ACTIVE') {
      return res.status(400).json({
        error: {
          code: 'DEBT_NOT_ACTIVE',
          message: 'Only active debts can be updated',
        },
      });
    }

    const { name, creditor, monthlyDue, dueDay, status, note } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (creditor !== undefined) data.creditor = creditor;
    if (monthlyDue !== undefined) data.monthlyDue = monthlyDue;
    if (dueDay !== undefined) data.dueDay = dueDay;
    if (status !== undefined) data.status = status;
    if (note !== undefined) data.note = note;

    const updated = await prisma.debt.update({
      where: { id },
      data,
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    if (req.user.role !== 'USER') {
      return res.status(403).json({
        error: {
          code: 'AUTH_FORBIDDEN',
          message: '此操作僅限當事人。監督人無法刪除債務',
        },
      });
    }

    const { id } = req.params;

    const debt = await prisma.debt.findFirst({
      where: { id, userId: req.user.id, isDeleted: false },
    });

    if (!debt) {
      return res.status(404).json({
        error: {
          code: 'DEBT_NOT_FOUND',
          message: 'Debt not found',
        },
      });
    }

    // Check if there are approved repayment transactions
    const approvedRepayments = await prisma.transaction.count({
      where: {
        debtId: id,
        type: 'REPAYMENT',
        status: 'APPROVED',
      },
    });

    if (approvedRepayments > 0) {
      return res.status(400).json({
        error: {
          code: 'DEBT_HAS_REPAYMENTS',
          message: 'Cannot delete debt with approved repayment transactions',
        },
      });
    }

    // Soft delete
    await prisma.debt.update({
      where: { id },
      data: { isDeleted: true },
    });

    res.json({ data: { message: 'Debt deleted successfully' } });
  } catch (err) {
    next(err);
  }
}

export async function getPayments(req, res, next) {
  try {
    const { id } = req.params;
    const targetUserId = await getPairedUserId(req);

    const debt = await prisma.debt.findFirst({
      where: { id, userId: targetUserId, isDeleted: false },
    });

    if (!debt) {
      return res.status(404).json({
        error: {
          code: 'DEBT_NOT_FOUND',
          message: 'Debt not found',
        },
      });
    }

    const payments = await prisma.transaction.findMany({
      where: {
        debtId: id,
        type: 'REPAYMENT',
        status: 'APPROVED',
      },
      orderBy: { date: 'desc' },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    res.json({ data: payments });
  } catch (err) {
    next(err);
  }
}
