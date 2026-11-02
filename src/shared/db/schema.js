import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// API output: `_id` becomes `id`, internal fields are removed.
function transform(doc, ret) {
  if (ret._id !== undefined) ret.id = String(ret._id);
  delete ret._id;
  delete ret.passwordHash;
  return ret;
}

const jsonOptions = { versionKey: false, flattenMaps: true, transform };

export const ref = (model, extra = {}) => ({ type: ObjectId, ref: model, ...extra });

// Base for transactional documents: timestamps + who created/updated it.
export function documentSchema(definition, options = {}) {
  return new mongoose.Schema(
    { ...definition, createdBy: ref('User'), updatedBy: ref('User') },
    { timestamps: true, toJSON: jsonOptions, ...options },
  );
}

// Base for master data: same as documentSchema plus an `isActive` flag.
// Masters are never deleted, only deactivated (so old records still point to them).
export function masterSchema(definition, options = {}) {
  return documentSchema(
    { ...definition, isActive: { type: Boolean, default: true, index: true } },
    options,
  );
}

// Embedded objects (voucher lines, shipment items...). Pass { id: true } to keep an id per row.
export function subSchema(definition, { id = false } = {}) {
  return new mongoose.Schema(definition, { _id: id, toJSON: jsonOptions });
}
