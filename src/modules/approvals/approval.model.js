import mongoose from 'mongoose';
import { documentSchema, ref } from '#shared/db/schema.js';
import { APPROVAL_STATUS } from '#shared/constants/enums.js';

const approvalSchema = documentSchema({
  // What is waiting, e.g. 'voucher' or 'stock_adjustment'.
  type: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: Object.values(APPROVAL_STATUS),
    default: APPROVAL_STATUS.PENDING,
    index: true,
  },
  branchId: ref('Branch', { index: true }),
  title: { type: String, required: true },
  amount: { type: Number, default: 0 },
  // Everything needed to finish the action once approved.
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  requestedBy: ref('User', { required: true }),
  requestedByName: String,
  decidedBy: ref('User'),
  decidedByName: String,
  decidedAt: Date,
  decisionNote: String,
  // What the approval produced, e.g. the posted voucher.
  result: {
    refType: String,
    refId: mongoose.Schema.Types.ObjectId,
    refNo: String,
  },
});

export const Approval = mongoose.model('Approval', approvalSchema);
