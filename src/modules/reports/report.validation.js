import { z } from 'zod';
import { dateString, objectId } from '#shared/utils/schemas.js';

const range = z
  .object({ from: dateString.optional(), to: dateString.optional() })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: '"from" must be before "to"' });

export const trialBalanceQuery = range;
export const profitLossQuery = range;
export const balanceSheetQuery = z.object({ asOf: dateString.optional() });

export const ledgerQuery = z.object({
  accountId: objectId,
  from: dateString.optional(),
  to: dateString.optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(2000),
});

export const agingQuery = z.object({
  kind: z.enum(['receivable', 'payable']).default('receivable'),
  asOf: dateString.optional(),
});

export const salesSummaryQuery = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
  groupBy: z.enum(['day', 'branch', 'item', 'productType']).default('day'),
});
