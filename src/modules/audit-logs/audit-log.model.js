import mongoose from 'mongoose';
import { ref } from '#shared/db/schema.js';

// Append-only record of every change made through the API.
const auditLogSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now, index: true },
    userId: ref('User', { index: true }),
    userName: String,
    method: String,
    path: String,
    statusCode: Number,
    branchId: ref('Branch'),
    ip: String,
    durationMs: Number,
  },
  {
    versionKey: false,
    toJSON: {
      versionKey: false,
      transform(doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
