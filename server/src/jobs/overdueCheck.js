import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import { createNotification } from '../controllers/notification.controller.js';

/**
 * Check for overdue debts:
 * - Find ACTIVE debts where today is past dueDay AND no APPROVED repayment this month
 * - Notify both the user and the supervisor
 */
export async function checkOverdueDebts() {
  const now = new Date();
  const today = now.getDate();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const debts = await prisma.debt.findMany({
    where: {
      isDeleted: false,
      status: 'ACTIVE',
      dueDay: { lte: today },
    },
    include: { user: true },
  });

  let notified = 0;
  for (const debt of debts) {
    // Check if there's an APPROVED repayment this month
    const repayment = await prisma.transaction.findFirst({
      where: {
        debtId: debt.id,
        type: 'REPAYMENT',
        status: 'APPROVED',
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    if (repayment) continue;

    // Check if we already sent an OVERDUE notification this month
    const existing = await prisma.notification.findFirst({
      where: {
        recipientId: debt.userId,
        type: 'DEBT_OVERDUE',
        referenceId: debt.id,
        createdAt: { gte: startOfMonth },
      },
    });
    if (existing) continue;

    // Notify user
    await createNotification(
      debt.userId,
      'DEBT_OVERDUE',
      '債務還款逾期',
      `債務「${debt.name}」（債權人：${debt.creditor}）本月尚未還款，到期日 ${debt.dueDay} 號`,
      'Debt',
      debt.id
    );

    // Notify supervisor if paired
    const pairing = await prisma.pairing.findFirst({
      where: { userId: debt.userId, status: 'ACTIVE' },
    });
    if (pairing) {
      await createNotification(
        pairing.supervisorId,
        'DEBT_OVERDUE',
        '配對對象債務逾期',
        `${debt.user.name} 的債務「${debt.name}」本月尚未還款`,
        'Debt',
        debt.id
      );
    }

    notified++;
  }

  return { checked: debts.length, notified };
}

let scheduledTask = null;

export function startOverdueCheckJob() {
  if (scheduledTask) return;
  // Daily at 01:00
  scheduledTask = cron.schedule('0 1 * * *', async () => {
    try {
      const result = await checkOverdueDebts();
      console.log(`[overdueCheck] checked=${result.checked} notified=${result.notified}`);
    } catch (err) {
      console.error('[overdueCheck] failed:', err);
    }
  });
  console.log('[overdueCheck] scheduled daily at 01:00');
}

export function stopOverdueCheckJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
