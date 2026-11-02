import { Router } from 'express';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { idParams } from '#shared/utils/schemas.js';
import { branchController as c } from './branch.controller.js';
import { createBranchSchema, listBranchesSchema, updateBranchSchema } from './branch.validation.js';

const router = Router();
const canManage = requirePermission(P.BRANCHES_MANAGE);

// Every logged-in user can list the branches they work in (for the branch switcher).
router.get('/', validate({ query: listBranchesSchema }), c.list);
router.get('/:id', validate({ params: idParams }), c.get);
router.post('/', canManage, validate({ body: createBranchSchema }), c.create);
router.patch('/:id', canManage, validate({ params: idParams, body: updateBranchSchema }), c.update);
router.post('/:id/deactivate', canManage, validate({ params: idParams }), c.deactivate);
router.post('/:id/reactivate', canManage, validate({ params: idParams }), c.reactivate);

export default router;
