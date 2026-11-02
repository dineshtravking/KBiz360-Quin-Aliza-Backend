import { z } from 'zod';
import { dateString, exchangeRate, periodString } from '#shared/utils/schemas.js';

export const fxSchema = z
  .object({ cdfAccountingRate: exchangeRate, cdfSalesRate: exchangeRate })
  .strict();

export const financialYearSchema = z
  .object({ start: dateString, end: dateString })
  .strict()
  .refine((v) => v.start < v.end, 'The year must end after it starts');

export const taxSchema = z
  .object({
    tvaRate: z.coerce.number().min(0).max(100).optional(),
    applyTvaOnSales: z.boolean().optional(),
  })
  .strict();

export const inventorySchema = z.object({ allowNegativeStock: z.boolean() }).strict();

export const periodParams = z.object({ period: periodString });
