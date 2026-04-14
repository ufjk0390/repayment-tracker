import { z } from 'zod';
import { positiveFloat } from './common.schema.js';

export const createDebtSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  creditor: z.string().min(1, 'Creditor is required').max(200),
  originalAmount: positiveFloat,
  monthlyDue: positiveFloat,
  dueDay: z.number().int().min(1).max(31),
  note: z.string().max(500).optional(),
});

export const updateDebtSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  creditor: z.string().min(1).max(200).optional(),
  monthlyDue: positiveFloat.optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  note: z.string().max(500).optional().nullable(),
});
