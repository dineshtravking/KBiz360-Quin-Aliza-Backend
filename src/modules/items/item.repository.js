import { Item } from './item.model.js';

export const itemRepository = {
  find: (filter, { skip, limit, sort }) => Item.find(filter).sort(sort).skip(skip).limit(limit),
  findAll: (filter) => Item.find(filter),
  count: (filter) => Item.countDocuments(filter),
  findById: (id, session) => Item.findById(id).session(session ?? null),
  findByIds: (ids, session) => Item.find({ _id: { $in: ids } }).session(session ?? null),
  findByName: (name) => Item.findOne({ name }),
  create: (data, session) => new Item(data).save({ session }),
  update: (id, data) =>
    Item.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true }),
};
