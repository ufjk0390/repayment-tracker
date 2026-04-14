import prisma from './prisma.js';

/**
 * Create an audit log entry. Failures are logged but do not throw.
 * @param {object} req - Express request object (for ip/userAgent)
 * @param {string} action - e.g. TRANSACTION_CREATED, DEBT_DELETED
 * @param {string} targetType - e.g. Transaction, Debt
 * @param {string} targetId
 * @param {object} [detail] - JSON-serializable object
 */
export async function audit(req, action, targetType, targetId, detail = null) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || 'system',
        action,
        targetType,
        targetId: String(targetId),
        detail: detail ? JSON.stringify(detail) : null,
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      },
    });
  } catch (err) {
    // Never let audit failures break the main flow
    console.error('[audit] failed to log:', err.message);
  }
}
