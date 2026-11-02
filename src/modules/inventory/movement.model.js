import mongoose from 'mongoose';
import { documentSchema, ref } from '#shared/db/schema.js';
import { PRODUCT_TYPES, STOCK_MOVEMENT_TYPES } from '#shared/constants/enums.js';

// The stock ledger: one row per stock change. Never edited or deleted —
// mistakes are fixed with a new movement (adjustment, return...).
const movementSchema = documentSchema({
  date: { type: String, required: true },
  period: { type: String, required: true },
  type: { type: String, enum: STOCK_MOVEMENT_TYPES, required: true },
  direction: { type: String, enum: ['in', 'out'], required: true },
  itemId: ref('Item', { required: true }),
  itemName: String,
  unit: String,
  productType: { type: String, enum: PRODUCT_TYPES },
  branchId: ref('Branch', { required: true }),
  godownId: ref('Godown', { required: true }),
  qty: { type: Number, required: true, min: 0 },
  // Cost per unit used for this movement (moving average for outgoing stock).
  unitCost: { type: Number, required: true, min: 0 },
  value: { type: Number, required: true },
  // Godown balance right after this movement.
  balanceQty: Number,
  balanceAvgCost: Number,
  // The document that caused it, e.g. { type: 'voucher', id, no: 'CS-00001/S1/1126' }.
  ref: {
    type: { type: String },
    id: mongoose.Schema.Types.ObjectId,
    no: String,
  },
  notes: String,
});

movementSchema.index({ itemId: 1, godownId: 1, createdAt: 1 });
movementSchema.index({ branchId: 1, date: -1 });
movementSchema.index({ 'ref.id': 1 });

export const StockMovement = mongoose.model('StockMovement', movementSchema);
