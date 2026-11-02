import mongoose from 'mongoose';
import { masterSchema, ref } from '#shared/db/schema.js';

// A warehouse / stockroom. Every godown belongs to one branch.
const godownSchema = masterSchema({
  name: { type: String, required: true, trim: true, unique: true },
  code: String,
  branchId: ref('Branch', { required: true, index: true }),
  address: String,
  city: String,
  contact: String,
  isDefault: { type: Boolean, default: false },
  notes: String,
});

export const Godown = mongoose.model('Godown', godownSchema);
