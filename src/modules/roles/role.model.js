import mongoose from 'mongoose';
import { masterSchema } from '#shared/db/schema.js';
import { ALL_PERMISSIONS } from '#shared/constants/permissions.js';

const roleSchema = masterSchema({
  // Set only on built-in roles, e.g. 'general_manager'.
  key: { type: String, unique: true, sparse: true },
  name: { type: String, required: true, trim: true, unique: true },
  description: String,
  permissions: [{ type: String, enum: ALL_PERMISSIONS }],
  isSuperAdmin: { type: Boolean, default: false },
  isReadOnly: { type: Boolean, default: false },
  canApprove: { type: Boolean, default: false },
  // USD. Manual vouchers above this go to the approval queue. null = no limit.
  approvalLimit: { type: Number, default: 0, min: 0 },
  isBuiltIn: { type: Boolean, default: false },
});

export const Role = mongoose.model('Role', roleSchema);
