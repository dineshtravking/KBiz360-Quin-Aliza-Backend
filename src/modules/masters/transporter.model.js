import mongoose from 'mongoose';
import { masterSchema, subSchema } from '#shared/db/schema.js';

const driverSchema = subSchema({ name: String, phone: String, licenseNo: String }, { id: true });

const transporterSchema = masterSchema({
  name: { type: String, required: true, trim: true, unique: true },
  country: String,
  contact: String,
  phone: String,
  email: String,
  drivers: { type: [driverSchema], default: [] },
  notes: String,
});

export const Transporter = mongoose.model('Transporter', transporterSchema);
