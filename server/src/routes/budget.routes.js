import { Router } from 'express';
import { list, create, update, remove, summary } from '../controllers/budget.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createBudgetSchema, updateBudgetSchema } from '../schemas/budget.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', list);
router.post('/', validate(createBudgetSchema), create);
router.get('/summary', summary);
router.put('/:id', validate(updateBudgetSchema), update);
router.delete('/:id', remove);

export default router;
