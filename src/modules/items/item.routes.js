import { Router } from 'express';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { idParams } from '#shared/utils/schemas.js';
import { itemController as c } from './item.controller.js';
import { createItemSchema, listItemsSchema, updateItemSchema } from './item.validation.js';

const router = Router();
// POS and stock screens need the item list too.
const canView = requirePermission(P.ITEMS_VIEW, P.SALES_CREATE, P.INVENTORY_VIEW, P.IMPORTS_VIEW);
const canManage = requirePermission(P.ITEMS_MANAGE);

router.get('/', canView, validate({ query: listItemsSchema }), c.list);
router.get('/:id', canView, validate({ params: idParams }), c.get);
router.post('/', canManage, validate({ body: createItemSchema }), c.create);
router.patch('/:id', canManage, validate({ params: idParams, body: updateItemSchema }), c.update);
router.post('/:id/deactivate', canManage, validate({ params: idParams }), c.deactivate);
router.post('/:id/reactivate', canManage, validate({ params: idParams }), c.reactivate);

export default router;
