import { Router } from 'express';
import { invite, join, getStatus, dissolve } from '../controllers/pairing.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/invite', invite);
router.post('/join', join);
router.get('/', getStatus);
router.post('/dissolve', dissolve);

export default router;
