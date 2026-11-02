import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { branchService } from './branch.service.js';

export const branchController = {
  async list(req, res) {
    const { items, meta } = await branchService.list(req.valid.query, req.scope);
    res.json(new ApiResponse(items, 'OK', meta));
  },
  async get(req, res) {
    res.json(new ApiResponse(await branchService.getById(req.valid.params.id, req.scope)));
  },
  async create(req, res) {
    const branch = await branchService.create(req.valid.body, req.user);
    res.status(201).json(new ApiResponse(branch, 'Branch created'));
  },
  async update(req, res) {
    const branch = await branchService.update(req.valid.params.id, req.valid.body, req.user);
    res.json(new ApiResponse(branch, 'Branch updated'));
  },
  async deactivate(req, res) {
    const branch = await branchService.setActive(req.valid.params.id, false, req.user);
    res.json(new ApiResponse(branch, 'Branch deactivated'));
  },
  async reactivate(req, res) {
    const branch = await branchService.setActive(req.valid.params.id, true, req.user);
    res.json(new ApiResponse(branch, 'Branch reactivated'));
  },
};
