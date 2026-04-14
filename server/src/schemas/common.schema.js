import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const positiveFloat = z.number()
  .positive('Amount must be a positive number')
  .max(10000000, 'Amount must not exceed 10,000,000');

export const dateString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid date format' }
).refine(
  (val) => {
    const d = new Date(val);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return d <= today;
  },
  { message: 'Date cannot be in the future' }
);
