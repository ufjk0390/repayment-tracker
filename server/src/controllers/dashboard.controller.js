import prisma from '../lib/prisma.js';
import { getPairedUserId } from '../middleware/authorize.js';

export async function getSummary(req, res, next) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    if (req.user.role === 'USER') {
      // USER dashboard
      const userId = req.user.id;

      // This month totals (APPROVED only)
      const [incomeAgg, expenseAgg, repaymentAgg] = await Promise.all([
        prisma.transaction.aggregate({
          where: {
            userId,
            type: 'INCOME',
            status: 'APPROVED',
            date: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            userId,
            type: 'EXPENSE',
            status: 'APPROVED',
            date: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            userId,
            type: 'REPAYMENT',
            status: 'APPROVED',
            date: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { amount: true },
        }),
      ]);

      // Debt progress
      const debts = await prisma.debt.findMany({
        where: { userId, isDeleted: false, status: 'ACTIVE' },
        select: { id: true, name: true, originalAmount: true, currentBalance: true, creditor: true },
      });

      const totalDebt = debts.reduce((sum, d) => sum + d.originalAmount, 0);
      const totalRemaining = debts.reduce((sum, d) => sum + d.currentBalance, 0);

      // Budget status
      const budgets = await prisma.budget.findMany({
        where: {
          userId,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        },
        include: { category: { select: { id: true, name: true } } },
      });

      const budgetStatus = await Promise.all(
        budgets.map(async (b) => {
          const spent = await prisma.transaction.aggregate({
            where: {
              userId,
              categoryId: b.categoryId,
              type: 'EXPENSE',
              status: 'APPROVED',
              date: { gte: startOfMonth, lte: endOfMonth },
            },
            _sum: { amount: true },
          });
          return {
            category: b.category,
            limit: b.limitAmount,
            spent: spent._sum.amount || 0,
            remaining: b.limitAmount - (spent._sum.amount || 0),
          };
        })
      );

      // Pending / rejected counts
      const [pendingCount, rejectedCount] = await Promise.all([
        prisma.transaction.count({
          where: { userId, status: 'PENDING' },
        }),
        prisma.transaction.count({
          where: { userId, status: 'REJECTED' },
        }),
      ]);

      // Recent transactions (last 5 APPROVED)
      const recentTransactions = await prisma.transaction.findMany({
        where: { userId, status: 'APPROVED' },
        orderBy: { date: 'desc' },
        take: 5,
        include: {
          category: { select: { id: true, name: true } },
        },
      });

      // Expense by category (current month, APPROVED)
      const expenseByCategoryRaw = await prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          userId,
          type: 'EXPENSE',
          status: 'APPROVED',
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      });

      const expenseCategories = await prisma.category.findMany({
        where: { id: { in: expenseByCategoryRaw.map((e) => e.categoryId) } },
        select: { id: true, name: true },
      });
      const categoryMap = Object.fromEntries(expenseCategories.map((c) => [c.id, c.name]));
      const expenseByCategory = expenseByCategoryRaw.map((e) => ({
        categoryId: e.categoryId,
        name: categoryMap[e.categoryId] || '未知',
        amount: e._sum.amount || 0,
      }));

      // Monthly trend (last 6 months income/expense/repayment)
      const monthlyTrend = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
        const [inc, exp, rep] = await Promise.all([
          prisma.transaction.aggregate({
            where: { userId, type: 'INCOME', status: 'APPROVED', date: { gte: monthStart, lte: monthEnd } },
            _sum: { amount: true },
          }),
          prisma.transaction.aggregate({
            where: { userId, type: 'EXPENSE', status: 'APPROVED', date: { gte: monthStart, lte: monthEnd } },
            _sum: { amount: true },
          }),
          prisma.transaction.aggregate({
            where: { userId, type: 'REPAYMENT', status: 'APPROVED', date: { gte: monthStart, lte: monthEnd } },
            _sum: { amount: true },
          }),
        ]);
        monthlyTrend.push({
          month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
          income: inc._sum.amount || 0,
          expense: exp._sum.amount || 0,
          repayment: rep._sum.amount || 0,
        });
      }

      return res.json({
        data: {
          thisMonth: {
            income: incomeAgg._sum.amount || 0,
            expense: expenseAgg._sum.amount || 0,
            repayment: repaymentAgg._sum.amount || 0,
            netIncome: (incomeAgg._sum.amount || 0) - (expenseAgg._sum.amount || 0) - (repaymentAgg._sum.amount || 0),
          },
          debts,
          debtProgress: {
            totalDebt,
            totalRemaining,
            totalPaid: totalDebt - totalRemaining,
            progressPercent: totalDebt > 0 ? Math.round(((totalDebt - totalRemaining) / totalDebt) * 100) : 0,
            activeDebts: debts.length,
          },
          budgetStatus,
          pendingCount,
          rejectedCount,
          recentTransactions,
          expenseByCategory,
          monthlyTrend,
        },
      });
    }

    if (req.user.role === 'SUPERVISOR') {
      // SUPERVISOR dashboard
      const pairedUserId = await getPairedUserId(req);
      if (!pairedUserId) {
        return res.json({
          data: {
            pendingCount: 0,
            paired: false,
            message: 'No active pairing',
          },
        });
      }

      const pairedUser = await prisma.user.findUnique({
        where: { id: pairedUserId },
        select: { id: true, name: true, email: true },
      });

      // Pending transactions count
      const pendingCount = await prisma.transaction.count({
        where: { userId: pairedUserId, status: 'PENDING' },
      });

      // Paired user's this-month totals
      const [incomeAgg, expenseAgg, repaymentAgg] = await Promise.all([
        prisma.transaction.aggregate({
          where: {
            userId: pairedUserId,
            type: 'INCOME',
            status: 'APPROVED',
            date: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            userId: pairedUserId,
            type: 'EXPENSE',
            status: 'APPROVED',
            date: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            userId: pairedUserId,
            type: 'REPAYMENT',
            status: 'APPROVED',
            date: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { amount: true },
        }),
      ]);

      // Plan execution rate
      const activePlan = await prisma.repaymentPlan.findFirst({
        where: { userId: pairedUserId, status: 'ACTIVE' },
        include: { planItems: true },
      });

      let planExecutionRate = null;
      if (activePlan) {
        const planStart = new Date(activePlan.startDate);
        const monthsElapsed = Math.max(
          1,
          (now.getFullYear() - planStart.getFullYear()) * 12 +
            (now.getMonth() - planStart.getMonth()) + 1
        );

        const totalPlanned = activePlan.planItems.reduce(
          (sum, item) => sum + item.monthlyAmount * monthsElapsed,
          0
        );

        const totalActualAgg = await prisma.transaction.aggregate({
          where: {
            userId: pairedUserId,
            type: 'REPAYMENT',
            status: 'APPROVED',
            date: { gte: activePlan.startDate },
          },
          _sum: { amount: true },
        });

        const totalActual = totalActualAgg._sum.amount || 0;
        planExecutionRate = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
      }

      // Alerts: over-budget categories, overdue debts
      const alerts = [];

      // Check over-budget
      const budgets = await prisma.budget.findMany({
        where: {
          userId: pairedUserId,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        },
        include: { category: true },
      });

      for (const budget of budgets) {
        const spent = await prisma.transaction.aggregate({
          where: {
            userId: pairedUserId,
            categoryId: budget.categoryId,
            type: 'EXPENSE',
            status: 'APPROVED',
            date: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { amount: true },
        });

        const spentAmount = spent._sum.amount || 0;
        if (spentAmount > budget.limitAmount) {
          alerts.push({
            type: 'OVER_BUDGET',
            message: `${budget.category.name} 已超出預算 (${spentAmount}/${budget.limitAmount})`,
          });
        }
      }

      // Recent pending transactions for supervisor
      const pendingTransactions = await prisma.transaction.findMany({
        where: { userId: pairedUserId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { category: { select: { id: true, name: true } } },
      });

      // Paired user's debts overview
      const supDebts = await prisma.debt.findMany({
        where: { userId: pairedUserId, isDeleted: false, status: 'ACTIVE' },
        select: { id: true, name: true, originalAmount: true, currentBalance: true, creditor: true },
      });

      return res.json({
        data: {
          paired: true,
          pairedUser,
          pendingCount,
          thisMonth: {
            income: incomeAgg._sum.amount || 0,
            expense: expenseAgg._sum.amount || 0,
            repayment: repaymentAgg._sum.amount || 0,
          },
          planExecutionRate,
          alerts,
          pendingTransactions,
          debts: supDebts,
        },
      });
    }
  } catch (err) {
    next(err);
  }
}
