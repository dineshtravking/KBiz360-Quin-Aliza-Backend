import { z } from 'zod';
import { email } from '#shared/utils/schemas.js';
import { password } from '#modules/users/user.validation.js';

export const loginSchema = z
  .object({ email, password: z.string().min(1, 'Password is required').max(128) })
  .strict();

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: password })
  .strict();
