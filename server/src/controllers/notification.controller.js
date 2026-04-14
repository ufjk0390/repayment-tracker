import prisma from '../lib/prisma.js';

export async function createNotification(recipientId, type, title, message, referenceType, referenceId) {
  return prisma.notification.create({
    data: {
      recipientId,
      type,
      title,
      message,
      referenceType: referenceType || null,
      referenceId: referenceId || null,
    },
  });
}

export async function list(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.notification.count({
        where: { recipientId: req.user.id },
      }),
    ]);

    res.json({
      data: notifications,
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

export async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: { id, recipientId: req.user.id },
    });

    if (!notification) {
      return res.status(404).json({
        error: {
          code: 'NOTIFICATION_NOT_FOUND',
          message: 'Notification not found',
        },
      });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { recipientId: req.user.id, isRead: false },
      data: { isRead: true },
    });

    res.json({ data: { message: 'All notifications marked as read' } });
  } catch (err) {
    next(err);
  }
}

export async function unreadCount(req, res, next) {
  try {
    const count = await prisma.notification.count({
      where: { recipientId: req.user.id, isRead: false },
    });

    res.json({ data: { count } });
  } catch (err) {
    next(err);
  }
}
