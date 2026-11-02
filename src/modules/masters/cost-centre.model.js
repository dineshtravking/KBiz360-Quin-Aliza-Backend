import mongoose from 'mongoose';
import { masterSchema, ref } from '#shared/db/schema.js';

const costCentreSchema = masterSchema({
  name: { type: String, required: true, trim: true, unique: true },
  code: String,
  branchId: ref('Branch', { required: true, index: true }),
  description: String,
});

export const CostCentre = mongoose.model('CostCentre', costCentreSchema);
