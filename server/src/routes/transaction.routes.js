import { Router } from 'express';
import { list, create, getById, update, remove, review, batchReview } from '../controllers/transaction.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createTransactionSchema, updateTransactionSchema, reviewTransactionSchema, batchReviewSchema } from '../schemas/transaction.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', list);
router.post('/', validate(createTransactionSchema), create);
router.post('/batch-review', validate(batchReviewSchema), batchReview);
router.get('/:id', getById);
router.put('/:id', validate(updateTransactionSchema), update);
router.delete('/:id', remove);
router.patch('/:id/review', validate(reviewTransactionSchema), review);

export default router;
