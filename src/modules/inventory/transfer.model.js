import mongoose from 'mongoose';
import { documentSchema, ref, subSchema } from '#shared/db/schema.js';

const transferItemSchema = subSchema({
  itemId: ref('Item', { required: true }),
  itemName: String,
  unit: String,
  qty: { type: Number, required: true },
  // Filled when approved: the cost the stock moved at.
  unitCost: Number,
});

// Stock moving between godowns/branches. While "pending" the goods are
// "floating" (frontend term); stock only moves when it is approved.
const transferSchema = documentSchema({
  transferNo: { type: String, required: true, unique: true },
  date: { type: String, required: true },
  fromBranchId: ref('Branch', { required: true, index: true }),
  fromGodownId: ref('Godown', { required: true }),
  toBranchId: ref('Branch', { required: true, index: true }),
  toGodownId: ref('Godown', { required: true }),
  items: { type: [transferItemSchema], required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    index: true,
  },
  notes: String,
  approvedBy: ref('User'),
  approvedAt: Date,
  rejectedBy: ref('User'),
  rejectedAt: Date,
  rejectionReason: String,
});

export const StockTransfer = mongoose.model('StockTransfer', transferSchema);
