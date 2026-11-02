import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { roleService } from './role.service.js';

export const roleController = {
  async list(req, res) {
    const { items, meta } = await roleService.list(req.valid.query);
    res.json(new ApiResponse(items, 'OK', meta));
  },
  permissions(req, res) {
    res.json(new ApiResponse(roleService.listPermissions()));
  },
  async get(req, res) {
    res.json(new ApiResponse(await roleService.getById(req.valid.params.id)));
  },
  async create(req, res) {
    const role = await roleService.create(req.valid.body, req.user);
    res.status(201).json(new ApiResponse(role, 'Role created'));
  },
  async update(req, res) {
    const role = await roleService.update(req.valid.params.id, req.valid.body, req.user);
    res.json(new ApiResponse(role, 'Role updated'));
  },
  async deactivate(req, res) {
    const role = await roleService.setActive(req.valid.params.id, false, req.user);
    res.json(new ApiResponse(role, 'Role deactivated'));
  },
  async reactivate(req, res) {
    const role = await roleService.setActive(req.valid.params.id, true, req.user);
    res.json(new ApiResponse(role, 'Role reactivated'));
  },
};
