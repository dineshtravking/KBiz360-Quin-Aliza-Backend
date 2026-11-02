import mongoose from 'mongoose';
import { documentSchema, ref } from '#shared/db/schema.js';
import { PRODUCT_TYPES } from '#shared/constants/enums.js';

// Current stock of one item in one godown. Updated in the same transaction
// as every movement, so it always matches the ledger.
const balanceSchema = documentSchema({
  itemId: ref('Item', { required: true }),
  godownId: ref('Godown', { required: true }),
  branchId: ref('Branch', { required: true, index: true }),
  productType: { type: String, enum: PRODUCT_TYPES },
  qty: { type: Number, default: 0 },
  // Moving average cost per unit (USD).
  avgCost: { type: Number, default: 0 },
  value: { type: Number, default: 0 },
});

balanceSchema.index({ itemId: 1, godownId: 1 }, { unique: true });

export const StockBalance = mongoose.model('StockBalance', balanceSchema);
