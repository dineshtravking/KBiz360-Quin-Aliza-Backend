import { Account } from './account.model.js';

export const accountRepository = {
  find: (filter, { skip, limit, sort }) => Account.find(filter).sort(sort).skip(skip).limit(limit),
  findAll: (filter = {}) => Account.find(filter).sort({ primaryGroup: 1, name: 1 }),
  count: (filter) => Account.countDocuments(filter),
  findById: (id, session) => Account.findById(id).session(session ?? null),
  findByIds: (ids, session) => Account.find({ _id: { $in: ids } }).session(session ?? null),
  findSystem: (systemKey, branchId, session) =>
    Account.findOne({ systemKey, branchId: branchId ?? null }).session(session ?? null),
  create: (data, session) => new Account(data).save({ session }),
  update: (id, data) =>
    Account.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true }),

  // Creates a system account if it does not exist yet (safe to run many times).
  upsertSystem(def, { session, userId } = {}) {
    return Account.findOneAndUpdate(
      { systemKey: def.systemKey, branchId: def.branchId ?? null },
      { $setOnInsert: { ...def, isSystem: true, createdBy: userId, updatedBy: userId } },
      { upsert: true, returnDocument: 'after', session },
    );
  },
};
