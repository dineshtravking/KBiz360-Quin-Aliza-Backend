import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { approvalService } from './approval.service.js';

const ctx = (req) => ({ user: req.user, scope: req.scope });

export const approvalController = {
  async list(req, res) {
    const { items, meta } = await approvalService.list(req.valid.query, req.scope);
    res.json(new ApiResponse(items, 'OK', meta));
  },
  async get(req, res) {
    res.json(new ApiResponse(await approvalService.getById(req.valid.params.id, req.scope)));
  },
  async approve(req, res) {
    const request = await approvalService.approve(
      req.valid.params.id,
      req.valid.body.note,
      ctx(req),
    );
    res.json(new ApiResponse(request, 'Approved'));
  },
  async reject(req, res) {
    const request = await approvalService.reject(
      req.valid.params.id,
      req.valid.body.note,
      ctx(req),
    );
    res.json(new ApiResponse(request, 'Rejected'));
  },
};
