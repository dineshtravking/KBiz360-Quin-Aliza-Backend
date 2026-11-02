import { Approval } from './approval.model.js';

export const approvalRepository = {
  find: (filter, { skip, limit, sort }) => Approval.find(filter).sort(sort).skip(skip).limit(limit),
  count: (filter) => Approval.countDocuments(filter),
  findById: (id, session) => Approval.findById(id).session(session ?? null),
  create: (data, session) => new Approval(data).save({ session }),
};
