import { Branch } from './branch.model.js';

export const branchRepository = {
  find: (filter, { skip, limit, sort }) => Branch.find(filter).sort(sort).skip(skip).limit(limit),
  count: (filter) => Branch.countDocuments(filter),
  findById: (id, session) => Branch.findById(id).session(session ?? null),
  findByIds: (ids) => Branch.find({ _id: { $in: ids } }),
  findOne: (filter) => Branch.findOne(filter),
  findAll: () => Branch.find().sort({ name: 1 }),
  create: (data, session) => new Branch(data).save({ session }),
  update: (id, data) =>
    Branch.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true }),
};
