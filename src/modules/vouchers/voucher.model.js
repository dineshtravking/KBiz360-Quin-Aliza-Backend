import mongoose from 'mongoose';
import { documentSchema, ref, subSchema } from '#shared/db/schema.js';
import {
  CURRENCIES,
  PARTY_TYPES,
  VOUCHER_SOURCES,
  VOUCHER_STATUS,
  VOUCHER_TYPES,
} from '#shared/constants/enums.js';

const { ObjectId } = mongoose.Schema.Types;

// One debit or credit row. Amounts are always USD (the book currency);
// fcAmount/fcCurrency/fxRate keep the original foreign-currency amount.
const lineSchema = subSchema({
  accountId: ref('Account', { required: true }),
  accountName: String,
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
  fcAmount: Number,
  fcCurrency: String,
  fxRate: Number,
  narration: String,
  costCentreId: ref('CostCentre'),
});

// Goods on a sale / purchase / return voucher.
const itemLineSchema = subSchema({
  itemId: ref('Item', { required: true }),
  itemName: String,
  unit: String,
  qty: Number,
  unitPrice: Number,
  amount: Number,
  // Cost at the moment of the movement (moving average) — used for COGS and returns.
  unitCost: Number,
  costAmount: Number,
  returnedQty: { type: Number, default: 0 },
});

// A receipt/payment allocated to an invoice.
const billRefSchema = subSchema({
  voucherId: ref('Voucher', { required: true }),
  voucherNo: String,
  amount: Number,
});

const partySchema = subSchema({
  kind: { type: String, enum: PARTY_TYPES, required: true },
  id: { type: ObjectId, required: true },
  name: String,
});

const voucherSchema = documentSchema({
  voucherNo: { type: String, required: true, unique: true },
  vType: { type: String, enum: VOUCHER_TYPES, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  period: { type: String, required: true }, // YYYY-MM
  branchId: ref('Branch', { required: true }),
  godownId: ref('Godown'),
  party: partySchema,
  narration: String,
  reference: String,
  currency: { type: String, enum: CURRENCIES, default: 'USD' },
  fxRate: Number,
  lines: {
    type: [lineSchema],
    validate: [(v) => v.length >= 2, 'A voucher needs at least two lines'],
  },
  totalDebit: { type: Number, required: true },
  totalCredit: { type: Number, required: true },
  items: { type: [itemLineSchema], default: undefined },

  // Invoices: what the customer/supplier owes, and how much is already settled.
  invoiceAmount: { type: Number, default: 0 },
  settledAmount: { type: Number, default: 0 },
  dueDate: String,
  billRefs: { type: [billRefSchema], default: undefined },

  status: {
    type: String,
    enum: Object.values(VOUCHER_STATUS),
    default: VOUCHER_STATUS.POSTED,
  },
  source: { type: String, enum: VOUCHER_SOURCES, default: 'manual' },
  sourceRef: { refType: String, refId: ObjectId, refNo: String },
  returnOf: ref('Voucher'),
  approvalId: ref('Approval'),
  approvedBy: ref('User'),
  voidReason: String,
  voidedAt: Date,
  voidedBy: ref('User'),
});

voucherSchema.index({ branchId: 1, date: -1 });
voucherSchema.index({ vType: 1, date: -1 });
voucherSchema.index({ status: 1, date: 1 });
voucherSchema.index({ 'party.id': 1, vType: 1, status: 1 });
voucherSchema.index({ 'lines.accountId': 1, date: 1 });

export const Voucher = mongoose.model('Voucher', voucherSchema);
