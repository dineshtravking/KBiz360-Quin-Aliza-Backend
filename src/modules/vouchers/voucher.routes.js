import { Router } from 'express';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { idParams, reason } from '#shared/utils/schemas.js';
import { voucherController as c } from './voucher.controller.js';
import {
  createVoucherSchema,
  listVouchersSchema,
  outstandingSchema,
} from './voucher.validation.js';

const router = Router();
const canView = requirePermission(P.VOUCHERS_VIEW);

router.get('/', canView, validate({ query: listVouchersSchema }), c.list);
router.get('/outstanding', canView, validate({ query: outstandingSchema }), c.outstanding);
router.get('/:id', canView, validate({ params: idParams }), c.get);
router.post(
  '/',
  requirePermission(P.VOUCHERS_CREATE),
  validate({ body: createVoucherSchema }),
  c.create,
);
router.post(
  '/:id/void',
  requirePermission(P.VOUCHERS_VOID),
  validate({ params: idParams, body: reason }),
  c.void,
);

export default router;
