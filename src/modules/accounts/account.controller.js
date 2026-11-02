import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { accountService } from './account.service.js';

export const accountController = {
  async list(req, res) {
    const { items, meta } = await accountService.list(req.valid.query, req.scope);
    res.json(new ApiResponse(items, 'OK', meta));
  },
  groups(req, res) {
    res.json(new ApiResponse(accountService.listGroups()));
  },
  async get(req, res) {
    res.json(new ApiResponse(await accountService.getById(req.valid.params.id)));
  },
  async create(req, res) {
    const account = await accountService.create(req.valid.body, req.user);
    res.status(201).json(new ApiResponse(account, 'Account created'));
  },
  async update(req, res) {
    const account = await accountService.update(req.valid.params.id, req.valid.body, req.user);
    res.json(new ApiResponse(account, 'Account updated'));
  },
  async deactivate(req, res) {
    const account = await accountService.setActive(req.valid.params.id, false, req.user);
    res.json(new ApiResponse(account, 'Account deactivated'));
  },
  async reactivate(req, res) {
    const account = await accountService.setActive(req.valid.params.id, true, req.user);
    res.json(new ApiResponse(account, 'Account reactivated'));
  },
};
