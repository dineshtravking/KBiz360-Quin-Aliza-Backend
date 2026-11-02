import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { userService } from './user.service.js';

export const userController = {
  async list(req, res) {
    const { items, meta } = await userService.list(req.valid.query);
    res.json(new ApiResponse(items, 'OK', meta));
  },
  async get(req, res) {
    res.json(new ApiResponse(await userService.getById(req.valid.params.id)));
  },
  async create(req, res) {
    const user = await userService.create(req.valid.body, req.user);
    res.status(201).json(new ApiResponse(user, 'User created'));
  },
  async update(req, res) {
    const user = await userService.update(req.valid.params.id, req.valid.body, req.user);
    res.json(new ApiResponse(user, 'User updated'));
  },
  async resetPassword(req, res) {
    await userService.resetPassword(req.valid.params.id, req.valid.body.password, req.user);
    res.json(new ApiResponse(null, 'Password reset. The user must change it at next login.'));
  },
  async deactivate(req, res) {
    const user = await userService.setActive(req.valid.params.id, false, req.user);
    res.json(new ApiResponse(user, 'User deactivated'));
  },
  async reactivate(req, res) {
    const user = await userService.setActive(req.valid.params.id, true, req.user);
    res.json(new ApiResponse(user, 'User reactivated'));
  },
};
