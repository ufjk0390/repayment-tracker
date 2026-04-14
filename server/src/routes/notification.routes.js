import { Router } from 'express';
import { list, markAsRead, markAllAsRead, unreadCount } from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', list);
router.get('/unread-count', unreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);

export default router;
