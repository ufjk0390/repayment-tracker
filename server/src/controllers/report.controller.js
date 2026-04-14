import prisma from '../lib/prisma.js';
import { getPairedUserId } from '../middleware/authorize.js';

function escapeCsvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportTransactions(req, res, next) {
  try {
    const targetUserId = await getPairedUserId(req);
    if (!targetUserId) {
      return res.status(400).json({
        error: { code: 'PAIRING_NOT_FOUND', message: 'No active pairing' },
      });
    }

    const { format = 'csv', year, month, startDate, endDate } = req.query;

    const where = { userId: targetUserId, status: 'APPROVED' };

    if (year && month) {
      const y = Number(year);
      const m = Number(month);
      where.date = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0, 23, 59, 59, 999),
      };
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        category: { select: { name: true } },
        debt: { select: { name: true, creditor: true } },
      },
    });

    if (format === 'csv') {
      const headers = ['日期', '類型', '金額', '分類', '債務', '債權人', '描述', '審核時間'];
      const rows = transactions.map((tx) => [
        tx.date.toISOString().split('T')[0],
        tx.type === 'INCOME' ? '收入' : tx.type === 'EXPENSE' ? '支出' : '還款',
        tx.amount,
        tx.category?.name || '',
        tx.debt?.name || '',
        tx.debt?.creditor || '',
        tx.description || '',
        tx.reviewedAt ? new Date(tx.reviewedAt).toISOString() : '',
      ]);

      // BOM for Excel UTF-8 compatibility
      const csv = '\ufeff' + [headers, ...rows]
        .map((row) => row.map(escapeCsvField).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="transactions-${Date.now()}.csv"`);
      return res.send(csv);
    }

    // JSON fallback
    res.json({ data: transactions });
  } catch (err) {
    next(err);
  }
}

export async function monthlyReport(req, res, next) {
  try {
    const targetUserId = await getPairedUserId(req);
    if (!targetUserId) {
      return res.status(400).json({
        error: { code: 'PAIRING_NOT_FOUND', message: 'No active pairing' },
      });
    }

    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'year and month are required' },
      });
    }

    const y = Number(year);
    const m = Number(month);
    const startOfMonth = new Date(y, m - 1, 1);
    const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);

    const [income, expense, repayment] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId: targetUserId, type: 'INCOME', status: 'APPROVED', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { userId: targetUserId, type: 'EXPENSE', status: 'APPROVED', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { userId: targetUserId, type: 'REPAYMENT', status: 'APPROVED', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    res.json({
      data: {
        year: y,
        month: m,
        summary: {
          income: { total: income._sum.amount || 0, count: income._count },
          expense: { total: expense._sum.amount || 0, count: expense._count },
          repayment: { total: repayment._sum.amount || 0, count: repayment._count },
          netIncome: (income._sum.amount || 0) - (expense._sum.amount || 0) - (repayment._sum.amount || 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
