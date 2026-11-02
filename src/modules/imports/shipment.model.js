import mongoose from 'mongoose';
import { documentSchema, ref, subSchema } from '#shared/db/schema.js';
import { IMPORT_ROUTES, PRODUCT_TYPES } from '#shared/constants/enums.js';
import { CHARGE_KEYS, PAYMENT_KINDS, SHIPMENT_STATUS } from './imports.constants.js';

const shipmentItemSchema = subSchema(
  {
    itemId: ref('Item', { required: true }),
    itemName: String,
    unit: String,
    qty: { type: Number, required: true },
    fobPrice: { type: Number, required: true }, // per unit, in the shipment currency
    salesPrice: { type: Number, default: 0 }, // planned selling price per unit, USD
    // Filled on delivery:
    receivedQty: Number,
    unitLandedCost: Number,
  },
  { id: true },
);

const stageSchema = subSchema({
  date: { type: String, required: true },
  notes: String,
  // Stage-specific details (truck number, BL number, AWB...).
  data: mongoose.Schema.Types.Mixed,
  updatedBy: ref('User'),
  updatedAt: Date,
});

const paymentSchema = subSchema(
  {
    date: String,
    amount: Number, // USD
    kind: { type: String, enum: PAYMENT_KINDS },
    accountId: ref('Account'),
    accountName: String,
    reference: String,
    notes: String,
    voucherId: ref('Voucher'),
    voucherNo: String,
  },
  { id: true },
);

const discrepancySchema = subSchema({
  lineId: mongoose.Schema.Types.ObjectId,
  itemName: String,
  orderedQty: Number,
  receivedQty: Number,
  diff: Number,
});

// An import shipment (frontend: IMPO, stored in data.vouchers).
const shipmentSchema = documentSchema({
  shipmentNo: { type: String, required: true, unique: true },
  route: { type: String, enum: IMPORT_ROUTES, required: true, index: true },
  branchId: ref('Branch', { required: true, index: true }),
  planId: ref('ImportPlan', { index: true }),
  supplierId: ref('Supplier', { required: true }),
  supplierName: String,
  transporterId: ref('Transporter'),
  transporterName: String,
  customAgencyId: ref('CustomAgency'),
  customAgencyName: String,
  country: String,
  // Supplier currency, e.g. USD, CNY, ZMW. exchangeRate = units per 1 USD.
  currency: { type: String, default: 'USD' },
  exchangeRate: { type: Number, default: 1 },
  orderDate: { type: String, required: true },
  productType: { type: String, enum: PRODUCT_TYPES },
  items: { type: [shipmentItemSchema], required: true },
  charges: Object.fromEntries(CHARGE_KEYS.map((k) => [k, { type: Number, default: 0, min: 0 }])),
  stages: { type: Map, of: stageSchema, default: {} },
  currentStage: String,
  status: { type: String, enum: SHIPMENT_STATUS, default: 'draft', index: true },
  delivery: {
    date: String,
    godownId: ref('Godown'),
    receivedBy: String,
    notes: String,
    noteType: String, // 'Short Delivery' | 'Excess Delivery' | 'Short & Excess'
    discrepancies: { type: [discrepancySchema], default: undefined },
    voucherId: ref('Voucher'),
  },
  payments: { type: [paymentSchema], default: [] },
  notes: String,
  voidReason: String,
  voidedAt: Date,
  voidedBy: ref('User'),
});

export const Shipment = mongoose.model('Shipment', shipmentSchema);
