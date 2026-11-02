import { Role } from './role.model.js';

export const roleRepository = {
  find: (filter, { skip, limit, sort }) => Role.find(filter).sort(sort).skip(skip).limit(limit),
  count: (filter) => Role.countDocuments(filter),
  findById: (id) => Role.findById(id),
  findByKey: (key) => Role.findOne({ key }),
  create: (data) => Role.create(data),
  update: (id, data) =>
    Role.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true }),

  // Creates a built-in role if missing. Existing roles keep any edits an admin made,
  // except Super Admin, which always gets every permission (including new ones).
  upsertBuiltIn(def) {
    const { permissions, ...rest } = def;
    const update = def.isSuperAdmin
      ? { $set: { permissions }, $setOnInsert: rest }
      : { $setOnInsert: def };
    return Role.findOneAndUpdate({ key: def.key }, update, {
      upsert: true,
      returnDocument: 'after',
    });
  },
};
