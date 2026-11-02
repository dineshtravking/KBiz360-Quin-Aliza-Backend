import { Router } from 'express';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { idParams, reason } from '#shared/utils/schemas.js';
import { inventoryController as c } from './inventory.controller.js';
import {
  adjustmentSchema,
  adjustmentsQuery,
  balancesQuery,
  movementsQuery,
  openingStockSchema,
  summaryQuery,
  transferSchema,
  transfersQuery,
} from './inventory.validation.js';

const router = Router();
const canView = requirePermission(P.INVENTORY_VIEW, P.SALES_CREATE);
const canManage = requirePermission(P.INVENTORY_MANAGE);
const canApprove = requirePermission(P.INVENTORY_APPROVE);

router.get('/balances', canView, validate({ query: balancesQuery }), c.balances);
router.get('/summary', canView, validate({ query: summaryQuery }), c.summary);
router.get('/valuation', canView, c.valuation);
router.get('/movements', canView, validate({ query: movementsQuery }), c.movements);
router.post('/opening-stock', canManage, validate({ body: openingStockSchema }), c.openingStock);

router.get('/transfers', canView, validate({ query: transfersQuery }), c.listTransfers);
router.get('/transfers/:id', canView, validate({ params: idParams }), c.getTransfer);
router.post('/transfers', canManage, validate({ body: transferSchema }), c.createTransfer);
router.post(
  '/transfers/:id/approve',
  canApprove,
  validate({ params: idParams }),
  c.approveTransfer,
);
router.post(
  '/transfers/:id/reject',
  canApprove,
  validate({ params: idParams, body: reason }),
  c.rejectTransfer,
);
router.post('/transfers/:id/cancel', canManage, validate({ params: idParams }), c.cancelTransfer);

router.get('/adjustments', canView, validate({ query: adjustmentsQuery }), c.listAdjustments);
router.get('/adjustments/:id', canView, validate({ params: idParams }), c.getAdjustment);
router.post('/adjustments', canManage, validate({ body: adjustmentSchema }), c.createAdjustment);

export default router;
