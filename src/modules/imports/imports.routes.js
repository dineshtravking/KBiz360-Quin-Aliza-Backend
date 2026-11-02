import { Router } from 'express';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { idParams, reason } from '#shared/utils/schemas.js';
import { planController as plans, shipmentController as shipments } from './imports.controller.js';
import {
  createPlanSchema,
  createShipmentSchema,
  deliverSchema,
  listPlansSchema,
  listShipmentsSchema,
  paymentSchema,
  stageParams,
  stageSchema,
  updatePlanSchema,
  updateShipmentSchema,
} from './imports.validation.js';

const canView = requirePermission(P.IMPORTS_VIEW);
const canManage = requirePermission(P.IMPORTS_MANAGE);

export const planRoutes = Router();
planRoutes.get('/', canView, validate({ query: listPlansSchema }), plans.list);
planRoutes.get('/:id', canView, validate({ params: idParams }), plans.get);
planRoutes.post('/', canManage, validate({ body: createPlanSchema }), plans.create);
planRoutes.patch(
  '/:id',
  canManage,
  validate({ params: idParams, body: updatePlanSchema }),
  plans.update,
);
planRoutes.post('/:id/complete', canManage, validate({ params: idParams }), plans.complete);
planRoutes.post('/:id/cancel', canManage, validate({ params: idParams }), plans.cancel);

export const shipmentRoutes = Router();
shipmentRoutes.get('/', canView, validate({ query: listShipmentsSchema }), shipments.list);
shipmentRoutes.get('/stages', canView, shipments.stages);
shipmentRoutes.get('/pipeline', canView, shipments.pipeline);
shipmentRoutes.get('/:id', canView, validate({ params: idParams }), shipments.get);
shipmentRoutes.post('/', canManage, validate({ body: createShipmentSchema }), shipments.create);
shipmentRoutes.patch(
  '/:id',
  canManage,
  validate({ params: idParams, body: updateShipmentSchema }),
  shipments.update,
);
shipmentRoutes.put(
  '/:id/stages/:stage',
  canManage,
  validate({ params: stageParams, body: stageSchema }),
  shipments.setStage,
);
shipmentRoutes.delete(
  '/:id/stages/:stage',
  canManage,
  validate({ params: stageParams }),
  shipments.revokeStage,
);
shipmentRoutes.post(
  '/:id/deliver',
  canManage,
  validate({ params: idParams, body: deliverSchema }),
  shipments.deliver,
);
shipmentRoutes.post(
  '/:id/payments',
  canManage,
  requirePermission(P.VOUCHERS_CREATE),
  validate({ params: idParams, body: paymentSchema }),
  shipments.addPayment,
);
shipmentRoutes.post(
  '/:id/void',
  requirePermission(P.IMPORTS_VOID),
  validate({ params: idParams, body: reason }),
  shipments.void,
);
