import { z } from 'zod';
import { PRODUCT_TYPES, STOCK_MOVEMENT_TYPES } from '#shared/constants/enums.js';
import { round4 } from '#shared/utils/money.js';
import {
  dateRange,
  dateString,
  listQuery,
  longText,
  objectId,
  quantity,
  unitCost,
} from '#shared/utils/schemas.js';
import { ADJUSTMENT_REASONS } from './adjustment.model.js';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const balancesQuery = listQuery.extend({
  itemId: objectId.optional(),
  godownId: objectId.optional(),
  productType: z.enum(PRODUCT_TYPES).optional(),
  lowStock: bool.optional(),
  includeZero: bool.optional(),
});

export const summaryQuery = z.object({ productType: z.enum(PRODUCT_TYPES).optional() });

export const movementsQuery = listQuery.extend({
  itemId: objectId.optional(),
  godownId: objectId.optional(),
  type: z.enum(STOCK_MOVEMENT_TYPES).optional(),
  ...dateRange,
});

export const openingStockSchema = z
  .object({
    date: dateString,
    branchId: objectId.optional(),
    godownId: objectId.optional(),
    notes: longText.optional(),
    items: z
      .array(z.object({ itemId: objectId, qty: quantity, unitCost }).strict())
      .min(1)
      .max(500),
  })
  .strict();

export const transferSchema = z
  .object({
    date: dateString,
    fromGodownId: objectId,
    toGodownId: objectId,
    notes: longText.optional(),
    items: z
      .array(z.object({ itemId: objectId, qty: quantity }).strict())
      .min(1)
      .max(200),
  })
  .strict()
  .refine((v) => v.fromGodownId !== v.toGodownId, {
    message: 'Source and destination godown must be different',
    path: ['toGodownId'],
  });

export const transfersQuery = listQuery.extend({
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  direction: z.enum(['in', 'out']).optional(),
  ...dateRange,
});

export const adjustmentSchema = z
  .object({
    date: dateString,
    branchId: objectId.optional(),
    godownId: objectId.optional(),
    reason: z.enum(ADJUSTMENT_REASONS),
    notes: longText.optional(),
    items: z
      .array(
        z
          .object({
            itemId: objectId,
            qtyChange: z.coerce
              .number()
              .finite()
              .refine((n) => n !== 0, 'Quantity change cannot be zero')
              .transform(round4),
            unitCost: unitCost.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();

export const adjustmentsQuery = listQuery.extend({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  ...dateRange,
});
