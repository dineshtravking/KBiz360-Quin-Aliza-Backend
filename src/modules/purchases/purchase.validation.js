import { z } from 'zod';
import {
  dateRange,
  dateString,
  listQuery,
  longText,
  objectId,
  quantity,
  shortText,
  unitCost,
} from '#shared/utils/schemas.js';

// Local purchase of stock (imports use /shipments instead).
export const createPurchaseSchema = z
  .object({
    date: dateString,
    branchId: objectId.optional(),
    godownId: objectId.optional(),
    supplierId: objectId,
    paymentMode: z.enum(['credit', 'cash']).default('credit'),
    paymentAccountId: objectId.optional(), // cash/bank account, required for cash
    reference: shortText.optional(), // supplier's invoice number
    dueDate: dateString.optional(),
    narration: longText.optional(),
    items: z
      .array(z.object({ itemId: objectId, qty: quantity, unitCost }).strict())
      .min(1)
      .max(200),
  })
  .strict()
  .refine((v) => v.paymentMode === 'credit' || v.paymentAccountId, {
    message: 'Pick the cash or bank account the purchase was paid from',
    path: ['paymentAccountId'],
  });

export const purchaseReturnSchema = z
  .object({
    date: dateString,
    notes: longText.optional(),
    items: z
      .array(z.object({ itemId: objectId, qty: quantity }).strict())
      .min(1)
      .max(200),
  })
  .strict();

export const listPurchasesSchema = listQuery.extend({
  supplierId: objectId.optional(),
  ...dateRange,
});
