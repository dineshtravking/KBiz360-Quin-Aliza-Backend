import mongoose from 'mongoose';
import { masterSchema, ref } from '#shared/db/schema.js';
import { CURRENCIES } from '#shared/constants/enums.js';

const accountSchema = masterSchema({
  name: { type: String, required: true, trim: true, unique: true },
  code: { type: String, trim: true, unique: true, sparse: true },
  primaryGroup: { type: Number, required: true, min: 1, max: 15 },
  // Sub-group label shown in the chart, e.g. "Cash-in-Hand", "Sundry Debtors".
  groupName: String,
  nature: {
    type: String,
    enum: ['asset', 'liability', 'equity', 'income', 'expense'],
    required: true,
  },
  currency: { type: String, enum: CURRENCIES, default: 'USD' },
  // Set on accounts the system posts to automatically (see SYSTEM_KEYS).
  systemKey: String,
  isSystem: { type: Boolean, default: false },
  // Only for branch-owned accounts (branch cash). Empty = company-wide.
  branchId: ref('Branch'),
  openingBalance: {
    amount: { type: Number, default: 0, min: 0 },
    side: { type: String, enum: ['Dr', 'Cr'], default: 'Dr' },
  },
  description: String,
});

// One system account per key (per branch for branch cash).
accountSchema.index(
  { systemKey: 1, branchId: 1 },
  { unique: true, partialFilterExpression: { systemKey: { $exists: true } } },
);

export const Account = mongoose.model('Account', accountSchema);
