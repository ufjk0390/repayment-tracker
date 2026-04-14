import { z } from 'zod';
import { positiveFloat, dateString } from './common.schema.js';

export const createTransactionSchema = z.object({
  date: dateString,
  type: z.enum(['INCOME', 'EXPENSE', 'REPAYMENT']),
  amount: positiveFloat,
  categoryId: z.string().min(1, 'Category is required'),
  debtId: z.string().optional().nullable(),
  description: z.string().max(500).optional(),
  attachmentUrl: z.string().url().optional().nullable(),
}).refine(
  (data) => {
    if (data.type === 'REPAYMENT' && !data.debtId) {
      return false;
    }
    return true;
  },
  { message: 'debtId is required for REPAYMENT transactions', path: ['debtId'] }
);

export const updateTransactionSchema = z.object({
  date: dateString.optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'REPAYMENT']).optional(),
  amount: positiveFloat.optional(),
  categoryId: z.string().min(1).optional(),
  debtId: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  attachmentUrl: z.string().url().optional().nullable(),
  version: z.number().int().positive('Version is required for optimistic locking'),
}).refine(
  (data) => {
    if (data.type === 'REPAYMENT' && data.debtId === undefined) {
      return false;
    }
    return true;
  },
  { message: 'debtId is required for REPAYMENT transactions', path: ['debtId'] }
);

export const reviewTransactionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reviewNote: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.action === 'REJECT' && (!data.reviewNote || data.reviewNote.trim() === '')) {
      return false;
    }
    return true;
  },
  { message: 'reviewNote is required when rejecting a transaction', path: ['reviewNote'] }
);

export const batchReviewSchema = z.object({
  reviews: z.array(
    z.object({
      id: z.string().min(1),
      action: z.enum(['APPROVE', 'REJECT']),
      reviewNote: z.string().max(500).optional(),
    }).refine(
      (data) => {
        if (data.action === 'REJECT' && (!data.reviewNote || data.reviewNote.trim() === '')) {
          return false;
        }
        return true;
      },
      { message: 'reviewNote is required when rejecting', path: ['reviewNote'] }
    )
  ).min(1, 'At least one review is required'),
});
