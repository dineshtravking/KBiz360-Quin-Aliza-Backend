import { Router } from 'express';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { idParams } from '#shared/utils/schemas.js';
import { userController as c } from './user.controller.js';
import {
  createUserSchema,
  listUsersSchema,
  resetPasswordSchema,
  updateUserSchema,
} from './user.validation.js';

const router = Router();
const canView = requirePermission(P.USERS_VIEW);
const canManage = requirePermission(P.USERS_MANAGE);

router.get('/', canView, validate({ query: listUsersSchema }), c.list);
router.get('/:id', canView, validate({ params: idParams }), c.get);
router.post('/', canManage, validate({ body: createUserSchema }), c.create);
router.patch('/:id', canManage, validate({ params: idParams, body: updateUserSchema }), c.update);
router.post(
  '/:id/reset-password',
  canManage,
  validate({ params: idParams, body: resetPasswordSchema }),
  c.resetPassword,
);
router.post('/:id/deactivate', canManage, validate({ params: idParams }), c.deactivate);
router.post('/:id/reactivate', canManage, validate({ params: idParams }), c.reactivate);

export default router;
