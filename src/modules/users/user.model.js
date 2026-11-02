import mongoose from 'mongoose';
import { masterSchema, ref } from '#shared/db/schema.js';

const userSchema = masterSchema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  // bcrypt hash. Never returned by queries unless asked for with select('+passwordHash').
  passwordHash: { type: String, required: true, select: false },
  roleId: ref('Role', { required: true }),
  // 'all' = every branch, 'specific' = only branchIds (frontend: businessMode/businessIds)
  branchMode: { type: String, enum: ['all', 'specific'], default: 'all' },
  branchIds: [ref('Branch')],
  phone: String,
  title: String,
  mustChangePassword: { type: Boolean, default: true },
  passwordChangedAt: Date,
  lastLoginAt: Date,
});

export const User = mongoose.model('User', userSchema);
