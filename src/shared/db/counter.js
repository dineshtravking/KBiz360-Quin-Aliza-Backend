import mongoose from 'mongoose';

// Running numbers for documents (vouchers, shipments, transfers...).
// $inc is atomic, so two users can never get the same number.

const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const Counter = mongoose.model('Counter', counterSchema);

export async function nextSequence(key, session) {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', session },
  );
  return counter.seq;
}
