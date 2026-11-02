import { Router } from 'express';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { idParams } from '#shared/utils/schemas.js';
import { accountController as c } from './account.controller.js';
import {
  createAccountSchema,
  listAccountsSchema,
  updateAccountSchema,
} from './account.validation.js';

const router = Router();
const canView = requirePermission(P.ACCOUNTS_VIEW, P.VOUCHERS_VIEW);
const canManage = requirePermission(P.ACCOUNTS_MANAGE);

router.get('/', canView, validate({ query: listAccountsSchema }), c.list);
router.get('/groups', canView, c.groups);
router.get('/:id', canView, validate({ params: idParams }), c.get);
router.post('/', canManage, validate({ body: createAccountSchema }), c.create);
router.patch(
  '/:id',
  canManage,
  validate({ params: idParams, body: updateAccountSchema }),
  c.update,
);
router.post('/:id/deactivate', canManage, validate({ params: idParams }), c.deactivate);
router.post('/:id/reactivate', canManage, validate({ params: idParams }), c.reactivate);

export default router;
