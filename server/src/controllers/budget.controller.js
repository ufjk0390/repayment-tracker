import prisma from '../lib/prisma.js';

export async function list(req, res, next) {
  try {
    const { year, month } = req.query;
    const where = { userId: req.user.id };

    if (year) where.year = Number(year);
    if (month) where.month = Number(month);

    const budgets = await prisma.budget.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    res.json({ data: budgets });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const { year, month, categoryId, limitAmount } = req.body;

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

    const budget = await prisma.budget.create({
      data: {
        userId: req.user.id,
        year,
        month,
        categoryId,
        limitAmount,
      },
      include: {
        category: { select: { id: true, name: true, type: true } },
      },
    });

    res.status(201).json({ data: budget });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: {
          code: 'BUDGET_ALREADY_EXISTS',
          message: 'A budget for this category in this month already exists',
        },
      });
    }
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;

    const budget = await prisma.budget.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!budget) {
      return res.status(404).json({
        error: {
          code: 'BUDGET_NOT_FOUND',
          message: 'Budget not found',
        },
      });
    }

    const { limitAmount } = req.body;

    const updated = await prisma.budget.update({
      where: { id },
      data: { limitAmount },
      include: {
        category: { select: { id: true, name: true, type: true } },
      },
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;

    const budget = await prisma.budget.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!budget) {
      return res.status(404).json({
        error: {
          code: 'BUDGET_NOT_FOUND',
          message: 'Budget not found',
        },
      });
    }

    await prisma.budget.delete({ where: { id } });

    res.json({ data: { message: 'Budget deleted successfully' } });
  } catch (err) {
    next(err);
  }
}

export async function summary(req, res, next) {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Year and month are required',
        },
      });
    }

    const y = Number(year);
    const m = Number(month);

    const budgets = await prisma.budget.findMany({
      where: {
        userId: req.user.id,
        year: y,
        month: m,
      },
      include: {
        category: { select: { id: true, name: true, type: true } },
      },
    });

    // Get start/end of month
    const startOfMonth = new Date(y, m - 1, 1);
    const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);

    // Calculate actual spending per category
    const budgetSummary = await Promise.all(
      budgets.map(async (budget) => {
        const actual = await prisma.transaction.aggregate({
          where: {
            userId: req.user.id,
            categoryId: budget.categoryId,
            type: 'EXPENSE',
            status: 'APPROVED',
            date: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          _sum: { amount: true },
        });

        const spent = actual._sum.amount || 0;
        const remaining = budget.limitAmount - spent;
        const usagePercent =
          budget.limitAmount > 0 ? Math.round((spent / budget.limitAmount) * 100) : 0;

        return {
          budgetId: budget.id,
          category: budget.category,
          limitAmount: budget.limitAmount,
          spent,
          remaining,
          usagePercent,
          isOverBudget: spent > budget.limitAmount,
        };
      })
    );

    const totalBudget = budgets.reduce((sum, b) => sum + b.limitAmount, 0);
    const totalSpent = budgetSummary.reduce((sum, b) => sum + b.spent, 0);

    res.json({
      data: {
        year: y,
        month: m,
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
        categories: budgetSummary,
      },
    });
  } catch (err) {
    next(err);
  }
}
