import { z } from 'zod';
import { ALL_PERMISSIONS } from '#shared/constants/permissions.js';
import { activeFilter, amount, listQuery, longText, name } from '#shared/utils/schemas.js';

export const createRoleSchema = z
  .object({
    name,
    description: longText.optional(),
    permissions: z
      .array(z.enum(ALL_PERMISSIONS))
      .transform((list) => [...new Set(list)])
      .default([]),
    isReadOnly: z.boolean().optional(),
    canApprove: z.boolean().optional(),
    approvalLimit: amount.nullable().optional(),
  })
  .strict();

export const updateRoleSchema = createRoleSchema.partial();

export const listRolesSchema = listQuery.extend({ isActive: activeFilter });
