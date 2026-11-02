import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { itemService } from './item.service.js';

export const itemController = {
  async list(req, res) {
    const { items, meta } = await itemService.list(req.valid.query);
    res.json(new ApiResponse(items, 'OK', meta));
  },
  async get(req, res) {
    res.json(new ApiResponse(await itemService.getById(req.valid.params.id)));
  },
  async create(req, res) {
    const item = await itemService.create(req.valid.body, req.user);
    res.status(201).json(new ApiResponse(item, 'Item created'));
  },
  async update(req, res) {
    const item = await itemService.update(req.valid.params.id, req.valid.body, req.user);
    res.json(new ApiResponse(item, 'Item updated'));
  },
  async deactivate(req, res) {
    const item = await itemService.setActive(req.valid.params.id, false, req.user);
    res.json(new ApiResponse(item, 'Item deactivated'));
  },
  async reactivate(req, res) {
    const item = await itemService.setActive(req.valid.params.id, true, req.user);
    res.json(new ApiResponse(item, 'Item reactivated'));
  },
};
