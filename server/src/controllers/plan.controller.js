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
    const where = { userId: targetUserId };
    if (status) where.status = status;

    const plans = await prisma.repaymentPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        planItems: {
          include: {
            debt: { select: { id: true, name: true, creditor: true, currentBalance: true } },
          },
        },
      },
    });

    res.json({ data: plans });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const userId = req.user.role === 'USER' ? req.user.id : null;
    if (!userId) {
      // Supervisor can also create plans for their paired user
      const pairedUserId = await getPairedUserId(req);
      if (!pairedUserId) {
        return res.status(400).json({
          error: { code: 'PAIRING_NOT_FOUND', message: 'No active pairing found' },
        });
      }
    }

    const targetUserId = req.user.role === 'USER' ? req.user.id : await getPairedUserId(req);

    // Check only one ACTIVE plan per user
    const existingActive = await prisma.repaymentPlan.findFirst({
      where: { userId: targetUserId, status: 'ACTIVE' },
    });

    if (existingActive) {
      return res.status(400).json({
        error: {
          code: 'PLAN_ALREADY_ACTIVE',
          message: 'User already has an active repayment plan',
        },
      });
    }

    const { name, startDate, endDate, totalTarget, note, items } = req.body;

    const plan = await prisma.repaymentPlan.create({
      data: {
        userId: targetUserId,
        name,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        totalTarget,
        note,
        planItems: {
          create: items.map((item) => ({
            debtId: item.debtId,
            monthlyAmount: item.monthlyAmount,
            priority: item.priority,
            note: item.note,
          })),
        },
      },
      include: {
        planItems: {
          include: {
            debt: { select: { id: true, name: true, creditor: true } },
          },
        },
      },
    });

    res.status(201).json({ data: plan });
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const targetUserId = await getPairedUserId(req);

    const plan = await prisma.repaymentPlan.findFirst({
      where: { id, userId: targetUserId },
      include: {
        planItems: {
          include: {
            debt: {
              select: {
                id: true,
                name: true,
                creditor: true,
                originalAmount: true,
                currentBalance: true,
                status: true,
              },
            },
          },
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!plan) {
      return res.status(404).json({
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Repayment plan not found',
        },
      });
    }

    // Calculate progress for each item
    const itemsWithProgress = await Promise.all(
      plan.planItems.map(async (item) => {
        const totalRepaid = await prisma.transaction.aggregate({
          where: {
            debtId: item.debtId,
            type: 'REPAYMENT',
            status: 'APPROVED',
            userId: targetUserId,
          },
          _sum: { amount: true },
        });

        return {
          ...item,
          totalRepaid: totalRepaid._sum.amount || 0,
        };
      })
    );

    res.json({
      data: {
        ...plan,
        planItems: itemsWithProgress,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const targetUserId = await getPairedUserId(req);

    const plan = await prisma.repaymentPlan.findFirst({
      where: { id, userId: targetUserId },
    });

    if (!plan) {
      return res.status(404).json({
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Repayment plan not found',
        },
      });
    }

    const { name, startDate, endDate, totalTarget, status, note, items } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (startDate) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (totalTarget !== undefined) data.totalTarget = totalTarget;
    if (status !== undefined) data.status = status;
    if (note !== undefined) data.note = note;

    // Wrap update + items replacement in atomic transaction (ME-06)
    const updated = await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.planItem.deleteMany({ where: { planId: id } });
        await tx.planItem.createMany({
          data: items.map((item) => ({
            planId: id,
            debtId: item.debtId,
            monthlyAmount: item.monthlyAmount,
            priority: item.priority,
            note: item.note,
          })),
        });
      }

      return tx.repaymentPlan.update({
        where: { id },
        data,
        include: {
          planItems: {
            include: {
              debt: { select: { id: true, name: true, creditor: true } },
            },
            orderBy: { priority: 'asc' },
          },
        },
      });
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const targetUserId = await getPairedUserId(req);

    const plan = await prisma.repaymentPlan.findFirst({
      where: { id, userId: targetUserId },
    });

    if (!plan) {
      return res.status(404).json({
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Repayment plan not found',
        },
      });
    }

    await prisma.repaymentPlan.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({ data: { message: 'Plan cancelled successfully' } });
  } catch (err) {
    next(err);
  }
}

export async function getProgress(req, res, next) {
  try {
    const { id } = req.params;
    const targetUserId = await getPairedUserId(req);

    const plan = await prisma.repaymentPlan.findFirst({
      where: { id, userId: targetUserId },
      include: {
        planItems: {
          include: {
            debt: {
              select: {
                id: true,
                name: true,
                creditor: true,
                originalAmount: true,
                currentBalance: true,
              },
            },
          },
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!plan) {
      return res.status(404).json({
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Repayment plan not found',
        },
      });
    }

    // Calculate months since plan start
    const startDate = new Date(plan.startDate);
    const now = new Date();
    const monthsElapsed = Math.max(
      1,
      (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth()) + 1
    );

    const progress = await Promise.all(
      plan.planItems.map(async (item) => {
        const totalRepaid = await prisma.transaction.aggregate({
          where: {
            debtId: item.debtId,
            type: 'REPAYMENT',
            status: 'APPROVED',
            userId: targetUserId,
            date: { gte: plan.startDate },
          },
          _sum: { amount: true },
        });

        const actualTotal = totalRepaid._sum.amount || 0;
        const plannedTotal = item.monthlyAmount * monthsElapsed;

        return {
          debtId: item.debtId,
          debtName: item.debt.name,
          creditor: item.debt.creditor,
          monthlyPlanned: item.monthlyAmount,
          plannedTotal,
          actualTotal,
          difference: actualTotal - plannedTotal,
          onTrack: actualTotal >= plannedTotal,
          originalAmount: item.debt.originalAmount,
          currentBalance: item.debt.currentBalance,
        };
      })
    );

    const totalPlanned = progress.reduce((sum, p) => sum + p.plannedTotal, 0);
    const totalActual = progress.reduce((sum, p) => sum + p.actualTotal, 0);

    res.json({
      data: {
        planId: plan.id,
        planName: plan.name,
        monthsElapsed,
        totalTarget: plan.totalTarget,
        totalPlanned,
        totalActual,
        executionRate: totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0,
        items: progress,
      },
    });
  } catch (err) {
    next(err);
  }
}
