import { Router } from 'express';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { idParams } from '#shared/utils/schemas.js';
import { approvalController as c } from './approval.controller.js';
import { approveSchema, listApprovalsSchema, rejectSchema } from './approval.validation.js';

const router = Router();
const canView = requirePermission(P.APPROVALS_VIEW);
const canDecide = requirePermission(P.APPROVALS_DECIDE);

router.get('/', canView, validate({ query: listApprovalsSchema }), c.list);
router.get('/:id', canView, validate({ params: idParams }), c.get);
router.post(
  '/:id/approve',
  canDecide,
  validate({ params: idParams, body: approveSchema }),
  c.approve,
);
router.post('/:id/reject', canDecide, validate({ params: idParams, body: rejectSchema }), c.reject);

export default router;
