import { Router } from 'express';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { idParams } from '#shared/utils/schemas.js';
import { purchaseController as c } from './purchase.controller.js';
import {
  createPurchaseSchema,
  listPurchasesSchema,
  purchaseReturnSchema,
} from './purchase.validation.js';

const router = Router();
const canCreate = requirePermission(P.PURCHASES_CREATE);

router.get(
  '/',
  requirePermission(P.PURCHASES_VIEW),
  validate({ query: listPurchasesSchema }),
  c.list,
);
router.get('/:id', requirePermission(P.PURCHASES_VIEW), validate({ params: idParams }), c.get);
router.post('/', canCreate, validate({ body: createPurchaseSchema }), c.create);
router.post(
  '/:id/returns',
  canCreate,
  validate({ params: idParams, body: purchaseReturnSchema }),
  c.createReturn,
);

export default router;
