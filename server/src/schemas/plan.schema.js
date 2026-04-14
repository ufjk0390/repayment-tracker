import { z } from 'zod';
import { positiveFloat, dateString } from './common.schema.js';

const planItemSchema = z.object({
  debtId: z.string().min(1, 'Debt ID is required'),
  monthlyAmount: positiveFloat,
  priority: z.number().int().min(1),
  note: z.string().max(500).optional(),
});

export const createPlanSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  startDate: dateString,
  endDate: dateString.optional().nullable(),
  totalTarget: positiveFloat,
  note: z.string().max(500).optional(),
  items: z.array(planItemSchema).min(1, 'At least one plan item is required'),
});

export const updatePlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional().nullable(),
  totalTarget: positiveFloat.optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  note: z.string().max(500).optional().nullable(),
  items: z.array(planItemSchema).min(1).optional(),
});
