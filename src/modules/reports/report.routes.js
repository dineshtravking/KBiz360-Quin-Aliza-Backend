import { Router } from 'express';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { reportController as c } from './report.controller.js';
import {
  agingQuery,
  balanceSheetQuery,
  ledgerQuery,
  profitLossQuery,
  salesSummaryQuery,
  trialBalanceQuery,
} from './report.validation.js';

const router = Router();
router.use(requirePermission(P.REPORTS_VIEW));

router.get('/dashboard', c.dashboard);
router.get('/trial-balance', validate({ query: trialBalanceQuery }), c.trialBalance);
router.get('/profit-loss', validate({ query: profitLossQuery }), c.profitLoss);
router.get('/balance-sheet', validate({ query: balanceSheetQuery }), c.balanceSheet);
router.get('/ledger', validate({ query: ledgerQuery }), c.ledger);
router.get('/cash-position', c.cashPosition);
router.get('/aging', validate({ query: agingQuery }), c.aging);
router.get('/sales-summary', validate({ query: salesSummaryQuery }), c.salesSummary);
router.get('/stock-valuation', c.stockValuation);

export default router;
