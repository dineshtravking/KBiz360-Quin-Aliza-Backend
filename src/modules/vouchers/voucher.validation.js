import { z } from 'zod';
import {
  MANUAL_VOUCHER_TYPES,
  VOUCHER_SOURCES,
  VOUCHER_STATUS,
  VOUCHER_TYPES,
} from '#shared/constants/enums.js';
import {
  amount,
  currency,
  dateRange,
  dateString,
  exchangeRate,
  listQuery,
  longText,
  objectId,
  positiveAmount,
  shortText,
} from '#shared/utils/schemas.js';

const lineSchema = z
  .object({
    accountId: objectId,
    debit: amount.default(0),
    credit: amount.default(0),
    narration: shortText.optional(),
    costCentreId: objectId.optional(),
  })
  .strict()
  .refine((l) => l.debit > 0 !== l.credit > 0, {
    message: 'Each line needs either a debit or a credit amount (not both)',
  });

export const partySchema = z
  .object({
    kind: z.enum(['client', 'supplier', 'transporter', 'custom_agency']),
    id: objectId,
  })
  .strict();

// Amounts are in `currency`. CDF vouchers are converted to USD line by line.
export const createVoucherSchema = z
  .object({
    vType: z.enum(MANUAL_VOUCHER_TYPES),
    date: dateString,
    branchId: objectId.optional(),
    party: partySchema.optional(),
    narration: longText.optional(),
    reference: shortText.optional(),
    currency: currency.default('USD'),
    fxRate: exchangeRate.optional(),
    dueDate: dateString.optional(),
    lines: z.array(lineSchema).min(2, 'A voucher needs at least two lines').max(200),
    // Receipts/payments: which invoices this money settles.
    billRefs: z
      .array(z.object({ voucherId: objectId, amount: positiveAmount }).strict())
      .max(100)
      .optional(),
    // Set to true to post a sale even though the customer goes over their credit limit.
    confirmCreditLimit: z.boolean().default(false),
  })
  .strict()
  .refine((v) => !v.billRefs?.length || ['receipt', 'payment'].includes(v.vType), {
    message: 'Only receipts and payments can settle invoices',
    path: ['billRefs'],
  });

export const listVouchersSchema = listQuery.extend({
  vType: z.enum(VOUCHER_TYPES).optional(),
  status: z.enum(Object.values(VOUCHER_STATUS)).optional(),
  source: z.enum(VOUCHER_SOURCES).optional(),
  partyId: objectId.optional(),
  accountId: objectId.optional(),
  ...dateRange,
});

export const outstandingSchema = z.object({
  kind: z.enum(['receivable', 'payable']).default('receivable'),
  partyId: objectId.optional(),
});
