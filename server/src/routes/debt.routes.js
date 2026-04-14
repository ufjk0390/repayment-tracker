import { Router } from 'express';
import { list, create, getById, update, remove, getPayments } from '../controllers/debt.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createDebtSchema, updateDebtSchema } from '../schemas/debt.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', list);
router.post('/', validate(createDebtSchema), create);
router.get('/:id', getById);
router.put('/:id', validate(updateDebtSchema), update);
router.delete('/:id', remove);
router.get('/:id/payments', getPayments);

export default router;
