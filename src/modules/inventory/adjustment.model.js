import mongoose from 'mongoose';
import { documentSchema, ref, subSchema } from '#shared/db/schema.js';

export const ADJUSTMENT_REASONS = [
  'damage',
  'loss',
  'found',
  'count_correction',
  'expiry',
  'other',
];

const adjustmentItemSchema = subSchema({
  itemId: ref('Item', { required: true }),
  itemName: String,
  // + adds stock, − removes stock.
  qtyChange: { type: Number, required: true },
  unitCost: Number,
});

// Stock corrections. They need General Manager approval (as in the frontend)
// and post a journal to the "Stock Adjustment" account when approved.
const adjustmentSchema = documentSchema({
  adjustmentNo: { type: String, required: true, unique: true },
  date: { type: String, required: true },
  branchId: ref('Branch', { required: true, index: true }),
  godownId: ref('Godown', { required: true }),
  reason: { type: String, enum: ADJUSTMENT_REASONS, required: true },
  notes: String,
  items: { type: [adjustmentItemSchema], required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
  approvalId: ref('Approval'),
  voucherId: ref('Voucher'),
  decidedBy: ref('User'),
  decidedAt: Date,
});

export const StockAdjustment = mongoose.model('StockAdjustment', adjustmentSchema);
