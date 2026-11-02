import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { saleService } from './sale.service.js';

const ctx = (req) => ({ user: req.user, scope: req.scope });

export const saleController = {
  async list(req, res) {
    const { items, meta } = await saleService.list(req.valid.query, req.scope);
    res.json(new ApiResponse(items, 'OK', meta));
  },
  async get(req, res) {
    res.json(new ApiResponse(await saleService.getById(req.valid.params.id, req.scope)));
  },
  async create(req, res) {
    const voucher = await saleService.createSale(req.valid.body, ctx(req));
    res.status(201).json(new ApiResponse(voucher, `Sale ${voucher.voucherNo} saved`));
  },
  async createReturn(req, res) {
    const voucher = await saleService.createReturn(req.valid.params.id, req.valid.body, ctx(req));
    res.status(201).json(new ApiResponse(voucher, `Return ${voucher.voucherNo} saved`));
  },
};
