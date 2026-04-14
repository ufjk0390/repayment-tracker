import prisma from '../lib/prisma.js';
import { getPairedUserId } from '../middleware/authorize.js';
import { createNotification } from './notification.controller.js';
import { audit } from '../lib/audit.js';

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

    const {
      type,
      status,
      categoryId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sort = 'date_desc',
    } = req.query;

    const where = { userId: targetUserId };

    if (type) where.type = type;
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [sortField, sortDir] = sort.split('_');
    const orderBy = { [sortField]: sortDir || 'desc' };

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          category: { select: { id: true, name: true, type: true } },
          debt: { select: { id: true, name: true, creditor: true } },
          reviewer: { select: { id: true, name: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      data: transactions,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
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
          message: 'Only users can create transactions',
        },
      });
    }

    // Check pairing
    const pairing = await prisma.pairing.findFirst({
      where: { userId: req.user.id, status: 'ACTIVE' },
    });

    if (!pairing) {
      return res.status(400).json({
        error: {
          code: 'PAIRING_NOT_FOUND',
          message: 'An active pairing is required to create transactions',
        },
      });
    }

    const { date, type, amount, categoryId, debtId, description, attachmentUrl } = req.body;

    // Validate category exists
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return res.status(404).json({
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: 'Category not found',
        },
      });
    }

    // If REPAYMENT, validate debt
    if (type === 'REPAYMENT') {
      const debt = await prisma.debt.findFirst({
        where: { id: debtId, userId: req.user.id, isDeleted: false },
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
            message: 'Debt is not active',
          },
        });
      }

      if (amount > debt.currentBalance) {
        return res.status(400).json({
          error: {
            code: 'TRANSACTION_AMOUNT_EXCEEDS_BALANCE',
            message: 'Repayment amount exceeds current debt balance',
          },
        });
      }
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user.id,
        date: new Date(date),
        type,
        amount,
        categoryId,
        debtId: debtId || null,
        description,
        attachmentUrl,
        status: 'PENDING',
      },
      include: {
        category: { select: { id: true, name: true, type: true } },
        debt: { select: { id: true, name: true, creditor: true } },
      },
    });

    // Notify supervisor
    await createNotification(
      pairing.supervisorId,
      'TRANSACTION_CREATED',
      '新交易待審核',
      `${req.user.name} 提交了一筆 ${type} 交易，金額 ${amount}`,
      'Transaction',
      transaction.id
    );

    await audit(req, 'TRANSACTION_CREATED', 'Transaction', transaction.id, { type, amount, categoryId });

    res.status(201).json({ data: transaction });
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const targetUserId = await getPairedUserId(req);

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: targetUserId },
      include: {
        category: { select: { id: true, name: true, type: true } },
        debt: { select: { id: true, name: true, creditor: true } },
        reviewer: { select: { id: true, name: true } },
      },
    });

    if (!transaction) {
      return res.status(404).json({
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found',
        },
      });
    }

    res.json({ data: transaction });
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
          message: 'Only users can update transactions',
        },
      });
    }

    const { id } = req.params;
    const { version, ...updateData } = req.body;

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!transaction) {
      return res.status(404).json({
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found',
        },
      });
    }

    if (transaction.status !== 'PENDING' && transaction.status !== 'REJECTED') {
      return res.status(400).json({
        error: {
          code: 'TRANSACTION_NOT_EDITABLE',
          message: 'Only PENDING or REJECTED transactions can be updated',
        },
      });
    }

    const data = {};
    if (updateData.date) data.date = new Date(updateData.date);
    if (updateData.type) data.type = updateData.type;
    if (updateData.amount) data.amount = updateData.amount;
    if (updateData.categoryId) data.categoryId = updateData.categoryId;
    if (updateData.debtId !== undefined) data.debtId = updateData.debtId;
    if (updateData.description !== undefined) data.description = updateData.description;
    if (updateData.attachmentUrl !== undefined) data.attachmentUrl = updateData.attachmentUrl;

    // If resubmitting a rejected transaction, reset to PENDING
    if (transaction.status === 'REJECTED') {
      data.status = 'PENDING';
      data.reviewNote = null;
      data.reviewedAt = null;
      data.reviewedBy = null;
    }

    // Atomic optimistic lock (C-04): WHERE includes version, increment in single statement
    const result = await prisma.transaction.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    });

    if (result.count === 0) {
      return res.status(409).json({
        error: {
          code: 'TRANSACTION_VERSION_CONFLICT',
          message: 'Transaction has been modified by another process',
        },
      });
    }

    const updated = await prisma.transaction.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, type: true } },
        debt: { select: { id: true, name: true, creditor: true } },
      },
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
          message: 'Only users can delete transactions',
        },
      });
    }

    const { id } = req.params;

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!transaction) {
      return res.status(404).json({
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found',
        },
      });
    }

    if (transaction.status !== 'PENDING') {
      return res.status(400).json({
        error: {
          code: 'TRANSACTION_NOT_DELETABLE',
          message: 'Only PENDING transactions can be deleted',
        },
      });
    }

    await prisma.transaction.delete({ where: { id } });

    res.json({ data: { message: 'Transaction deleted successfully' } });
  } catch (err) {
    next(err);
  }
}

export async function review(req, res, next) {
  try {
    if (req.user.role !== 'SUPERVISOR') {
      return res.status(403).json({
        error: {
          code: 'AUTH_FORBIDDEN',
          message: 'Only supervisors can review transactions',
        },
      });
    }

    const { id } = req.params;
    const { action, reviewNote } = req.body;

    const pairing = await prisma.pairing.findUnique({
      where: { supervisorId: req.user.id },
    });

    if (!pairing || pairing.status !== 'ACTIVE') {
      return res.status(400).json({
        error: {
          code: 'PAIRING_NOT_FOUND',
          message: 'No active pairing found',
        },
      });
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: pairing.userId },
    });

    if (!transaction) {
      return res.status(404).json({
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found',
        },
      });
    }

    if (transaction.status !== 'PENDING') {
      return res.status(400).json({
        error: {
          code: 'TRANSACTION_NOT_PENDING',
          message: 'Only PENDING transactions can be reviewed',
        },
      });
    }

    if (action === 'APPROVE') {
      const updateData = {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: req.user.id,
        reviewNote: reviewNote || null,
      };

      // If REPAYMENT, update debt balance in a transaction
      if (transaction.type === 'REPAYMENT' && transaction.debtId) {
        const result = await prisma.$transaction(async (tx) => {
          const updatedTx = await tx.transaction.update({
            where: { id },
            data: updateData,
          });

          const debt = await tx.debt.findUnique({
            where: { id: transaction.debtId },
          });

          const newBalance = debt.currentBalance - transaction.amount;
          const debtUpdate = {
            currentBalance: Math.max(0, newBalance),
          };

          if (newBalance <= 0) {
            debtUpdate.status = 'PAID_OFF';
          }

          await tx.debt.update({
            where: { id: transaction.debtId },
            data: debtUpdate,
          });

          return updatedTx;
        });

        await createNotification(
          pairing.userId,
          'TRANSACTION_APPROVED',
          '交易已核准',
          `您的還款交易已被核准，金額 ${transaction.amount}`,
          'Transaction',
          id
        );

        const updated = await prisma.transaction.findUnique({
          where: { id },
          include: {
            category: { select: { id: true, name: true, type: true } },
            debt: { select: { id: true, name: true, creditor: true } },
            reviewer: { select: { id: true, name: true } },
          },
        });

        return res.json({ data: updated });
      }

      // Non-repayment approval
      const updated = await prisma.transaction.update({
        where: { id },
        data: updateData,
        include: {
          category: { select: { id: true, name: true, type: true } },
          debt: { select: { id: true, name: true, creditor: true } },
          reviewer: { select: { id: true, name: true } },
        },
      });

      await createNotification(
        pairing.userId,
        'TRANSACTION_APPROVED',
        '交易已核准',
        `您的交易已被核准，金額 ${transaction.amount}`,
        'Transaction',
        id
      );

      return res.json({ data: updated });
    }

    if (action === 'REJECT') {
      const updated = await prisma.transaction.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedBy: req.user.id,
          reviewNote,
        },
        include: {
          category: { select: { id: true, name: true, type: true } },
          debt: { select: { id: true, name: true, creditor: true } },
          reviewer: { select: { id: true, name: true } },
        },
      });

      await createNotification(
        pairing.userId,
        'TRANSACTION_REJECTED',
        '交易已退回',
        `您的交易已被退回，原因：${reviewNote}`,
        'Transaction',
        id
      );

      return res.json({ data: updated });
    }

    return res.status(400).json({
      error: { code: 'INVALID_ACTION', message: 'Invalid review action' },
    });
  } catch (err) {
    next(err);
  }
}

export async function batchReview(req, res, next) {
  try {
    if (req.user.role !== 'SUPERVISOR') {
      return res.status(403).json({
        error: {
          code: 'AUTH_FORBIDDEN',
          message: 'Only supervisors can review transactions',
        },
      });
    }

    const pairing = await prisma.pairing.findUnique({
      where: { supervisorId: req.user.id },
    });

    if (!pairing || pairing.status !== 'ACTIVE') {
      return res.status(400).json({
        error: {
          code: 'PAIRING_NOT_FOUND',
          message: 'No active pairing found',
        },
      });
    }

    const { reviews } = req.body;

    const results = await prisma.$transaction(async (tx) => {
      const processed = [];

      for (const rev of reviews) {
        const transaction = await tx.transaction.findFirst({
          where: { id: rev.id, userId: pairing.userId, status: 'PENDING' },
        });

        if (!transaction) {
          throw new Error(`Transaction ${rev.id} not found or not pending - rolling back entire batch`);
        }

        if (rev.action === 'APPROVE') {
          const updateData = {
            status: 'APPROVED',
            reviewedAt: new Date(),
            reviewedBy: req.user.id,
            reviewNote: rev.reviewNote || null,
          };

          await tx.transaction.update({ where: { id: rev.id }, data: updateData });

          // If REPAYMENT, update debt
          if (transaction.type === 'REPAYMENT' && transaction.debtId) {
            const debt = await tx.debt.findUnique({
              where: { id: transaction.debtId },
            });

            if (debt) {
              const newBalance = debt.currentBalance - transaction.amount;
              const debtUpdate = { currentBalance: Math.max(0, newBalance) };
              if (newBalance <= 0) debtUpdate.status = 'PAID_OFF';
              await tx.debt.update({ where: { id: transaction.debtId }, data: debtUpdate });
            }
          }

          processed.push({ id: rev.id, success: true, status: 'APPROVED' });
        } else if (rev.action === 'REJECT') {
          await tx.transaction.update({
            where: { id: rev.id },
            data: {
              status: 'REJECTED',
              reviewedAt: new Date(),
              reviewedBy: req.user.id,
              reviewNote: rev.reviewNote,
            },
          });

          processed.push({ id: rev.id, success: true, status: 'REJECTED' });
        }
      }

      return processed;
    });

    // Send notifications for each reviewed transaction
    for (const result of results) {
      if (result.success) {
        const notifType = result.status === 'APPROVED' ? 'TRANSACTION_APPROVED' : 'TRANSACTION_REJECTED';
        const title = result.status === 'APPROVED' ? '交易已核准' : '交易已退回';
        await createNotification(pairing.userId, notifType, title, `您的交易已被${result.status === 'APPROVED' ? '核准' : '退回'}`, 'Transaction', result.id);
      }
    }

    res.json({ data: results });
  } catch (err) {
    next(err);
  }
}
