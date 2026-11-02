import mongoose from 'mongoose';
import { masterSchema, ref } from '#shared/db/schema.js';
import { BRANCH_TYPES, IMPORT_ROUTES } from '#shared/constants/enums.js';

const branchSchema = masterSchema({
  name: { type: String, required: true, trim: true, unique: true },
  shortName: String,
  // Short code used in document numbers, e.g. HO, TXHD, S1. Cannot change later.
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: BRANCH_TYPES, default: 'branch' },
  // Import routes this branch receives (frontend: cargoTypes).
  cargoTypes: [{ type: String, enum: IMPORT_ROUTES }],
  address: String,
  city: String,
  phone: String,
  color: String,
  defaultGodownId: ref('Godown'),
});

export const Branch = mongoose.model('Branch', branchSchema);
