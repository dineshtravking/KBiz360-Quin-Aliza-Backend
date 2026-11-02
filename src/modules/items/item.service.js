import { ApiError } from '#shared/utils/ApiError.js';
import { buildMeta, paginate, parseSort, searchFilter } from '#shared/utils/pagination.js';
import { nextSequence } from '#shared/db/counter.js';
import { itemCode } from '#shared/utils/docNumber.js';
import { PRODUCT_TYPE_CODES } from '#shared/constants/enums.js';
import { masterServices } from '#modules/masters/index.js';
import { itemRepository } from './item.repository.js';

export const itemService = {
  async list(query) {
    const { page, limit, skip } = paginate(query);
    const filter = searchFilter(query.search, ['name', 'itemCode', 'sku', 'barcode']);
    if (query.isActive !== 'all') filter.isActive = query.isActive === 'true';
    if (query.productType) filter.productType = query.productType;
    if (query.categoryId) filter.categoryId = query.categoryId;
    const sort = parseSort(query.sort, ['name', 'itemCode', 'salesPrice', 'createdAt'], {
      name: 1,
    });
    const [items, total] = await Promise.all([
      itemRepository.find(filter, { skip, limit, sort }),
      itemRepository.count(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },

  async getById(id) {
    const item = await itemRepository.findById(id);
    if (!item) throw ApiError.notFound('Item not found');
    return item;
  },

  async create(data, user) {
    if (data.categoryId) await masterServices.itemCategories.getActive(data.categoryId);
    return itemService.createInternal(data, user?.id);
  },

  // Also used by the seed script.
  async createInternal(data, userId) {
    const code =
      data.itemCode ??
      itemCode(
        PRODUCT_TYPE_CODES[data.productType],
        await nextSequence(`item:${data.productType}`),
      );
    return itemRepository.create({ ...data, itemCode: code, createdBy: userId, updatedBy: userId });
  },

  async update(id, data, user) {
    await itemService.getById(id);
    if (data.categoryId) await masterServices.itemCategories.getActive(data.categoryId);
    return itemRepository.update(id, { ...data, updatedBy: user.id });
  },

  async setActive(id, isActive, user) {
    await itemService.getById(id);
    return itemRepository.update(id, { isActive, updatedBy: user.id });
  },

  // For other modules: all ids must be active items. Returns a Map by id.
  async getActiveMany(ids, session) {
    const unique = [...new Set(ids.map(String))];
    const items = await itemRepository.findByIds(unique, session);
    const byId = new Map(items.map((i) => [String(i._id), i]));
    const missing = unique.filter((id) => !byId.get(id)?.isActive);
    if (missing.length) {
      throw ApiError.badRequest('Some items do not exist or are inactive', { itemIds: missing });
    }
    return byId;
  },

  getMany: async (ids) =>
    new Map((await itemRepository.findByIds(ids)).map((i) => [String(i._id), i])),
  findAll: (filter = {}) => itemRepository.findAll(filter),
  findByName: (name) => itemRepository.findByName(name),
};
