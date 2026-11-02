import { Router } from 'express';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { idParams } from '#shared/utils/schemas.js';
import { saleController as c } from './sale.controller.js';
import { createSaleSchema, listSalesSchema, saleReturnSchema } from './sale.validation.js';

const router = Router();

router.get('/', requirePermission(P.SALES_VIEW), validate({ query: listSalesSchema }), c.list);
router.get('/:id', requirePermission(P.SALES_VIEW), validate({ params: idParams }), c.get);
router.post('/', requirePermission(P.SALES_CREATE), validate({ body: createSaleSchema }), c.create);
router.post(
  '/:id/returns',
  requirePermission(P.SALES_RETURN),
  validate({ params: idParams, body: saleReturnSchema }),
  c.createReturn,
);

export default router;
