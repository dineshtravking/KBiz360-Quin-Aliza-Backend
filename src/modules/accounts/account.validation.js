import { z } from 'zod';
import {
  activeFilter,
  amount,
  currency,
  listQuery,
  longText,
  name,
  objectId,
  shortText,
} from '#shared/utils/schemas.js';

export const createAccountSchema = z
  .object({
    name,
    code: shortText.optional(),
    primaryGroup: z.coerce.number().int().min(1).max(15),
    groupName: shortText.optional(),
    currency: currency.optional(),
    branchId: objectId.optional(),
    openingBalance: z
      .object({ amount, side: z.enum(['Dr', 'Cr']) })
      .strict()
      .optional(),
    description: longText.optional(),
  })
  .strict();

export const updateAccountSchema = createAccountSchema.partial();

export const listAccountsSchema = listQuery.extend({
  isActive: activeFilter,
  primaryGroup: z.coerce.number().int().min(1).max(15).optional(),
  nature: z.enum(['asset', 'liability', 'equity', 'income', 'expense']).optional(),
  branchId: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
