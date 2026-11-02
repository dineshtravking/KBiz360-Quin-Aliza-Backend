import { Router } from 'express';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { idParams } from '#shared/utils/schemas.js';
import { roleController as c } from './role.controller.js';
import { createRoleSchema, listRolesSchema, updateRoleSchema } from './role.validation.js';

const router = Router();
const canView = requirePermission(P.ROLES_VIEW);
const canManage = requirePermission(P.ROLES_MANAGE);

router.get('/', canView, validate({ query: listRolesSchema }), c.list);
router.get('/permissions', canView, c.permissions);
router.get('/:id', canView, validate({ params: idParams }), c.get);
router.post('/', canManage, validate({ body: createRoleSchema }), c.create);
router.patch('/:id', canManage, validate({ params: idParams, body: updateRoleSchema }), c.update);
router.post('/:id/deactivate', canManage, validate({ params: idParams }), c.deactivate);
router.post('/:id/reactivate', canManage, validate({ params: idParams }), c.reactivate);

export default router;
