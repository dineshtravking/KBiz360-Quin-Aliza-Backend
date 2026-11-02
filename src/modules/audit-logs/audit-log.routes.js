import { Router } from 'express';
import { z } from 'zod';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { dateRange, listQuery, objectId } from '#shared/utils/schemas.js';
import { auditLogService } from './audit-log.service.js';

const listSchema = listQuery.extend({
  userId: objectId.optional(),
  method: z.enum(['POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  ...dateRange,
});

const router = Router();

router.get(
  '/',
  requirePermission(P.AUDIT_VIEW),
  validate({ query: listSchema }),
  async (req, res) => {
    const { items, meta } = await auditLogService.list(req.valid.query);
    res.json(new ApiResponse(items, 'OK', meta));
  },
);

export default router;
