import { z } from 'zod';
import { IMPORT_ROUTES, PRODUCT_TYPES } from '#shared/constants/enums.js';
import {
  amount,
  dateRange,
  dateString,
  exchangeRate,
  listQuery,
  longText,
  name,
  objectId,
  positiveAmount,
  quantity,
  shortText,
} from '#shared/utils/schemas.js';
import { round4 } from '#shared/utils/money.js';
import { CHARGE_KEYS, PAYMENT_KINDS, SHIPMENT_STATUS } from './imports.constants.js';

// ── Plans ───────────────────────────────────────────────────────────────────
const planItem = z
  .object({ itemId: objectId, plannedQty: quantity, targetFob: amount.optional() })
  .strict();

export const createPlanSchema = z
  .object({
    route: z.enum(IMPORT_ROUTES),
    name,
    branchId: objectId.optional(),
    supplierId: objectId.optional(),
    country: shortText.optional(),
    createdDate: dateString,
    notes: longText.optional(),
    items: z.array(planItem).min(1).max(500),
  })
  .strict();

export const updatePlanSchema = createPlanSchema.omit({ route: true, branchId: true }).partial();

export const listPlansSchema = listQuery.extend({
  route: z.enum(IMPORT_ROUTES).optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
});

// ── Shipments ───────────────────────────────────────────────────────────────
const shipmentItem = z
  .object({
    itemId: objectId,
    qty: quantity,
    fobPrice: z.coerce.number().finite().nonnegative().transform(round4),
    salesPrice: amount.optional(),
  })
  .strict();

const charges = z
  .object(Object.fromEntries(CHARGE_KEYS.map((k) => [k, amount.optional()])))
  .strict();

const shipmentFields = {
  planId: objectId.optional(),
  supplierId: objectId,
  transporterId: objectId.optional(),
  customAgencyId: objectId.optional(),
  country: shortText.optional(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code')
    .default('USD'),
  exchangeRate: exchangeRate.optional(),
  orderDate: dateString,
  productType: z.enum(PRODUCT_TYPES).optional(),
  items: z.array(shipmentItem).min(1).max(500),
  charges: charges.optional(),
  notes: longText.optional(),
};

const rateRule = [
  (v) => !v.currency || v.currency === 'USD' || v.exchangeRate,
  {
    message: 'Give the exchange rate (units per 1 USD) for a non-USD shipment',
    path: ['exchangeRate'],
  },
];

export const createShipmentSchema = z
  .object({ route: z.enum(IMPORT_ROUTES), branchId: objectId.optional(), ...shipmentFields })
  .strict()
  .refine(...rateRule);

export const updateShipmentSchema = z
  .object(shipmentFields)
  .partial()
  .strict()
  .refine(...rateRule);

export const listShipmentsSchema = listQuery.extend({
  route: z.enum(IMPORT_ROUTES).optional(),
  status: z.enum(SHIPMENT_STATUS).optional(),
  supplierId: objectId.optional(),
  planId: objectId.optional(),
  ...dateRange,
});

export const stageParams = z.object({ id: objectId, stage: z.string().regex(/^[a-z_]{2,40}$/) });

export const stageSchema = z
  .object({
    date: dateString,
    notes: longText.optional(),
    data: z.record(z.string().max(50), z.union([z.string().max(300), z.number()])).optional(),
  })
  .strict();

export const deliverSchema = z
  .object({
    date: dateString,
    godownId: objectId.optional(),
    receivedBy: shortText.optional(),
    notes: longText.optional(),
    // Leave out to receive exactly what was ordered.
    receivedQtys: z
      .array(
        z
          .object({
            lineId: objectId,
            qty: z.coerce.number().finite().nonnegative().transform(round4),
          })
          .strict(),
      )
      .max(500)
      .optional(),
  })
  .strict();

export const paymentSchema = z
  .object({
    date: dateString,
    amount: positiveAmount,
    kind: z.enum(PAYMENT_KINDS).default('supplier'),
    accountId: objectId,
    reference: shortText.optional(),
    notes: longText.optional(),
  })
  .strict();
