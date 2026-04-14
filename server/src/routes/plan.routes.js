import { Router } from 'express';
import { list, create, getById, update, remove, getProgress } from '../controllers/plan.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createPlanSchema, updatePlanSchema } from '../schemas/plan.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', list);
router.post('/', validate(createPlanSchema), create);
router.get('/:id', getById);
router.put('/:id', validate(updatePlanSchema), update);
router.delete('/:id', remove);
router.get('/:id/progress', getProgress);

export default router;
