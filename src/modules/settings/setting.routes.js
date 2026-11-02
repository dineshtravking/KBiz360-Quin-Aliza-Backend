import { Router } from 'express';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { settingController as c } from './setting.controller.js';
import {
  financialYearSchema,
  fxSchema,
  inventorySchema,
  periodParams,
  taxSchema,
} from './setting.validation.js';

const router = Router();
const canManage = requirePermission(P.SETTINGS_MANAGE);

// Every logged-in user can read settings (POS needs the exchange rates).
router.get('/', c.get);
router.put('/fx', canManage, validate({ body: fxSchema }), c.updateFx);
router.put(
  '/financial-year',
  canManage,
  validate({ body: financialYearSchema }),
  c.updateFinancialYear,
);
router.patch('/tax', canManage, validate({ body: taxSchema }), c.updateTax);
router.put('/inventory', canManage, validate({ body: inventorySchema }), c.updateInventory);
router.post('/periods/:period/lock', canManage, validate({ params: periodParams }), c.lockPeriod);
router.post(
  '/periods/:period/unlock',
  canManage,
  validate({ params: periodParams }),
  c.unlockPeriod,
);

export default router;
