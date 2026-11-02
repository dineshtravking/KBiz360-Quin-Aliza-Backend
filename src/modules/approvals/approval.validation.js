import { z } from 'zod';
import { APPROVAL_STATUS } from '#shared/constants/enums.js';
import { listQuery } from '#shared/utils/schemas.js';

export const listApprovalsSchema = listQuery.extend({
  status: z.enum(Object.values(APPROVAL_STATUS)).optional(),
  type: z.string().trim().max(50).optional(),
});

export const approveSchema = z.object({ note: z.string().trim().max(500).optional() }).strict();

export const rejectSchema = z
  .object({ note: z.string().trim().min(3, 'Please give a reason').max(500) })
  .strict();
