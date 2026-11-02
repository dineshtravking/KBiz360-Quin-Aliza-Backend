import { z } from 'zod';
import {
  amount,
  dateRange,
  dateString,
  listQuery,
  longText,
  objectId,
  quantity,
  shortText,
} from '#shared/utils/schemas.js';

export const createSaleSchema = z
  .object({
    date: dateString,
    branchId: objectId.optional(),
    godownId: objectId.optional(), // default: the branch's default godown
    saleType: z.enum(['cash', 'credit']),
    clientId: objectId.optional(), // required for credit sales
    // Cash sales only: CDF uses the POS sales rate (frontend: fx.CDF_sales).
    paymentCurrency: z.enum(['USD', 'CDF']).default('USD'),
    narration: longText.optional(),
    reference: shortText.optional(),
    dueDate: dateString.optional(),
    confirmCreditLimit: z.boolean().default(false),
    items: z
      .array(
        z
          .object({
            itemId: objectId,
            qty: quantity,
            unitPrice: amount.optional(), // default: the item's sales price
          })
          .strict(),
      )
      .min(1, 'Add at least one item')
      .max(200),
  })
  .strict()
  .refine((v) => v.saleType === 'cash' || v.clientId, {
    message: 'A credit sale needs a customer',
    path: ['clientId'],
  })
  .refine((v) => v.saleType === 'cash' || v.paymentCurrency === 'USD', {
    message: 'Credit sales are invoiced in USD',
    path: ['paymentCurrency'],
  });

export const saleReturnSchema = z
  .object({
    date: dateString,
    notes: longText.optional(),
    items: z
      .array(z.object({ itemId: objectId, qty: quantity }).strict())
      .min(1)
      .max(200),
  })
  .strict();

export const listSalesSchema = listQuery.extend({
  saleType: z.enum(['cash', 'credit']).optional(),
  clientId: objectId.optional(),
  ...dateRange,
});
