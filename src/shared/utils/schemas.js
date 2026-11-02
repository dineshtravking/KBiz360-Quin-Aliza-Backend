import { z } from 'zod';
import { CURRENCIES } from '#shared/constants/enums.js';
import { round2, round4 } from './money.js';

// Reusable Zod pieces for validation files.

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid id');

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  }, 'Not a real date');

export const periodString = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use the format YYYY-MM');

export const amount = z.coerce.number().finite().nonnegative().transform(round2);
export const positiveAmount = z.coerce.number().finite().positive().transform(round2);
export const unitCost = z.coerce.number().finite().nonnegative().transform(round4);
export const quantity = z.coerce.number().finite().positive().transform(round4);
export const exchangeRate = z.coerce.number().finite().positive();
export const currency = z.enum(CURRENCIES);

export const name = z.string().trim().min(1, 'Required').max(150);
export const shortText = z.string().trim().max(200);
export const longText = z.string().trim().max(2000);
export const email = z.string().trim().toLowerCase().email();
export const reason = z
  .object({ reason: z.string().trim().min(3, 'Please give a reason').max(500) })
  .strict();

export const idParams = z.object({ id: objectId });

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .string()
    .regex(/^-?[a-zA-Z.]+$/)
    .optional(),
  search: z.string().trim().max(100).optional(),
});

export const activeFilter = z.enum(['true', 'false', 'all']).default('true');

export const dateRange = {
  from: dateString.optional(),
  to: dateString.optional(),
};
