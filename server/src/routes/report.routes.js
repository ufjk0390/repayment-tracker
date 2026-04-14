import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { exportTransactions, monthlyReport } from '../controllers/report.controller.js';

const router = Router();

router.get('/export', authenticate, exportTransactions);
router.get('/monthly', authenticate, monthlyReport);

export default router;
