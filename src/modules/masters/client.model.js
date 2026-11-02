import mongoose from 'mongoose';
import { masterSchema, ref } from '#shared/db/schema.js';

const clientSchema = masterSchema({
  name: { type: String, required: true, trim: true, unique: true },
  code: { type: String, trim: true },
  phone: String,
  email: String,
  address: String,
  city: String,
  taxId: String,
  // USD. 0 means no credit limit.
  creditLimit: { type: Number, default: 0, min: 0 },
  paymentTermsDays: { type: Number, default: 0, min: 0 },
  priceListId: ref('PriceList'),
  notes: String,
});

export const Client = mongoose.model('Client', clientSchema);
