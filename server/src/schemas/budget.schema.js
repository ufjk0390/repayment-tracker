import { z } from 'zod';
import { positiveFloat } from './common.schema.js';

export const createBudgetSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  categoryId: z.string().min(1, 'Category is required'),
  limitAmount: positiveFloat,
});

export const updateBudgetSchema = z.object({
  limitAmount: positiveFloat,
});
