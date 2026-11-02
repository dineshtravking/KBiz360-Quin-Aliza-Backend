import mongoose from 'mongoose';
import { masterSchema, ref } from '#shared/db/schema.js';

// Bank account details. `ledgerAccountId` links it to the chart of accounts.
const bankAccountSchema = masterSchema({
  name: { type: String, required: true, trim: true, unique: true },
  bankName: String,
  accountNumber: String,
  swift: String,
  currency: { type: String, default: 'USD' },
  branchId: ref('Branch'),
  ledgerAccountId: ref('Account'),
  notes: String,
});

export const BankAccount = mongoose.model('BankAccount', bankAccountSchema);
