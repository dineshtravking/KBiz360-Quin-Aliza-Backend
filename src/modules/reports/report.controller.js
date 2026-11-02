import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { reportService } from './report.service.js';

const send = (res, data) => res.json(new ApiResponse(data));

export const reportController = {
  trialBalance: async (req, res) =>
    send(res, await reportService.trialBalance(req.valid.query, req.scope)),
  profitLoss: async (req, res) =>
    send(res, await reportService.profitAndLoss(req.valid.query, req.scope)),
  balanceSheet: async (req, res) =>
    send(res, await reportService.balanceSheet(req.valid.query, req.scope)),
  ledger: async (req, res) => send(res, await reportService.ledger(req.valid.query, req.scope)),
  cashPosition: async (req, res) => send(res, await reportService.cashPosition(req.scope)),
  aging: async (req, res) => send(res, await reportService.aging(req.valid.query, req.scope)),
  salesSummary: async (req, res) =>
    send(res, await reportService.salesSummary(req.valid.query, req.scope)),
  stockValuation: async (req, res) => send(res, await reportService.stockValuation(req.scope)),
  dashboard: async (req, res) => send(res, await reportService.dashboard(req.scope)),
};
