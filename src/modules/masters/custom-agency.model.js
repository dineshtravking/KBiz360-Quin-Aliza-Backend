import mongoose from 'mongoose';
import { masterSchema } from '#shared/db/schema.js';

// Clearing / customs agents used on import shipments.
const customAgencySchema = masterSchema({
  name: { type: String, required: true, trim: true, unique: true },
  country: String,
  contact: String,
  phone: String,
  email: String,
  registrationNo: String,
  address: String,
  notes: String,
});

export const CustomAgency = mongoose.model('CustomAgency', customAgencySchema);
