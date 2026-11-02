import mongoose from 'mongoose';
import { masterSchema } from '#shared/db/schema.js';

const supplierSchema = masterSchema({
  name: { type: String, required: true, trim: true, unique: true },
  country: String,
  contact: String,
  phone: String,
  email: String,
  address: String,
  currency: { type: String, default: 'USD' },
  paymentTerms: String,
  notes: String,
});

export const Supplier = mongoose.model('Supplier', supplierSchema);
