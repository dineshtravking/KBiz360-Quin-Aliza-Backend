import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { voucherService } from './voucher.service.js';

const ctx = (req) => ({ user: req.user, scope: req.scope });

export const voucherController = {
  async list(req, res) {
    const { items, meta } = await voucherService.list(req.valid.query, req.scope);
    res.json(new ApiResponse(items, 'OK', meta));
  },
  async outstanding(req, res) {
    res.json(new ApiResponse(await voucherService.outstanding(req.valid.query, req.scope)));
  },
  async get(req, res) {
    res.json(new ApiResponse(await voucherService.getById(req.valid.params.id, req.scope)));
  },
  // 201 when posted, 202 when it went to the approval queue.
  async create(req, res) {
    const result = await voucherService.postVoucher(req.valid.body, ctx(req));
    if (result.status === 'pending_approval') {
      return res
        .status(202)
        .json(new ApiResponse(result, 'Amount is above your limit — sent for approval'));
    }
    res.status(201).json(new ApiResponse(result, 'Voucher posted'));
  },
  async void(req, res) {
    const voucher = await voucherService.voidVoucher(
      req.valid.params.id,
      req.valid.body.reason,
      ctx(req),
    );
    res.json(new ApiResponse(voucher, 'Voucher voided'));
  },
};
