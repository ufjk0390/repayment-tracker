import { Router } from 'express';
import { getSummary } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/summary', getSummary);

export default router;
