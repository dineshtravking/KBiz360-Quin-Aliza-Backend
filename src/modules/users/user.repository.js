import { User } from './user.model.js';

export const userRepository = {
  find: (filter, { skip, limit, sort }) =>
    User.find(filter).sort(sort).skip(skip).limit(limit).populate('roleId', 'name key'),
  count: (filter) => User.countDocuments(filter),
  findById: (id) => User.findById(id),
  findByIdWithPassword: (id) => User.findById(id).select('+passwordHash'),
  findByEmailWithPassword: (email) => User.findOne({ email }).select('+passwordHash'),
  findByEmail: (email) => User.findOne({ email }),
  // Used on every request by the auth middleware.
  findAuthContext: (id) => User.findById(id).populate('roleId').lean(),
  create: (data) => User.create(data),
  update: (id, data) =>
    User.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true }),
};
