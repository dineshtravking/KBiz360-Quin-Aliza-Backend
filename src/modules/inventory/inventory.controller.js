import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { inventoryService } from './inventory.service.js';
import { transferService } from './transfer.service.js';
import { adjustmentService } from './adjustment.service.js';

const ctx = (req) => ({ user: req.user, scope: req.scope });
const page = (res, { items, meta }) => res.json(new ApiResponse(items, 'OK', meta));

export const inventoryController = {
  async balances(req, res) {
    page(res, await inventoryService.listBalances(req.valid.query, req.scope));
  },
  async summary(req, res) {
    res.json(new ApiResponse(await inventoryService.summaryByItem(req.valid.query, req.scope)));
  },
  async valuation(req, res) {
    res.json(new ApiResponse(await inventoryService.valuation(req.scope)));
  },
  async movements(req, res) {
    page(res, await inventoryService.listMovements(req.valid.query, req.scope));
  },
  async openingStock(req, res) {
    const result = await inventoryService.postOpeningStock(req.valid.body, ctx(req));
    res.status(201).json(new ApiResponse(result, 'Opening stock posted'));
  },

  async listTransfers(req, res) {
    page(res, await transferService.list(req.valid.query, req.scope));
  },
  async getTransfer(req, res) {
    res.json(new ApiResponse(await transferService.getById(req.valid.params.id, req.scope)));
  },
  async createTransfer(req, res) {
    const transfer = await transferService.create(req.valid.body, ctx(req));
    res.status(201).json(new ApiResponse(transfer, 'Transfer created — waiting for approval'));
  },
  async approveTransfer(req, res) {
    const transfer = await transferService.approve(req.valid.params.id, ctx(req));
    res.json(new ApiResponse(transfer, 'Transfer approved — stock moved'));
  },
  async rejectTransfer(req, res) {
    const transfer = await transferService.reject(
      req.valid.params.id,
      req.valid.body.reason,
      ctx(req),
    );
    res.json(new ApiResponse(transfer, 'Transfer rejected'));
  },
  async cancelTransfer(req, res) {
    res.json(
      new ApiResponse(
        await transferService.cancel(req.valid.params.id, ctx(req)),
        'Transfer cancelled',
      ),
    );
  },

  async listAdjustments(req, res) {
    page(res, await adjustmentService.list(req.valid.query, req.scope));
  },
  async getAdjustment(req, res) {
    res.json(new ApiResponse(await adjustmentService.getById(req.valid.params.id, req.scope)));
  },
  async createAdjustment(req, res) {
    const adjustment = await adjustmentService.create(req.valid.body, ctx(req));
    const message =
      adjustment.status === 'approved' ? 'Stock adjusted' : 'Adjustment sent for approval';
    res.status(201).json(new ApiResponse(adjustment, message));
  },
};
