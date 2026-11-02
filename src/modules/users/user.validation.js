import { z } from 'zod';
import {
  activeFilter,
  email,
  listQuery,
  name,
  objectId,
  shortText,
} from '#shared/utils/schemas.js';

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const userFields = {
  name,
  email,
  roleId: objectId,
  branchMode: z.enum(['all', 'specific']).default('all'),
  branchIds: z.array(objectId).max(50).default([]),
  phone: shortText.optional(),
  title: shortText.optional(),
};

const branchRule = (v) => v.branchMode !== 'specific' || v.branchIds?.length > 0;
const branchMessage = {
  message: 'Pick at least one branch for a branch-specific user',
  path: ['branchIds'],
};

export const createUserSchema = z
  .object({ ...userFields, password })
  .strict()
  .refine(branchRule, branchMessage);

export const updateUserSchema = z
  .object(userFields)
  .partial()
  .strict()
  .refine(branchRule, branchMessage);

export const resetPasswordSchema = z.object({ password }).strict();

export const listUsersSchema = listQuery.extend({
  isActive: activeFilter,
  roleId: objectId.optional(),
});
