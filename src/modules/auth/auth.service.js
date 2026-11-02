import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '#config/env.js';
import { ApiError } from '#shared/utils/ApiError.js';
import { ALL_PERMISSIONS } from '#shared/constants/permissions.js';
import { userService } from '#modules/users/index.js';

// Same message for "no such user" and "wrong password", so nobody can
// find out which emails exist.
const INVALID_LOGIN = 'Email or password is incorrect';

// Checked when the email does not exist, so both cases take the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', env.BCRYPT_ROUNDS);

const signToken = (userId) =>
  jwt.sign({ sub: String(userId) }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

// The user object put on req.user and returned by /auth/me.
export function toAuthUser(user) {
  const role = user.roleId;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    title: user.title,
    phone: user.phone,
    branchMode: user.branchMode,
    branchIds: (user.branchIds ?? []).map(String),
    mustChangePassword: user.mustChangePassword,
    role: {
      id: String(role._id),
      key: role.key,
      name: role.name,
      permissions: role.isSuperAdmin ? ALL_PERMISSIONS : role.permissions,
      isSuperAdmin: role.isSuperAdmin,
      isReadOnly: role.isReadOnly,
      canApprove: role.canApprove,
      approvalLimit: role.approvalLimit,
    },
  };
}

export const authService = {
  async login(email, password) {
    const user = await userService.findForLogin(email);
    const matches = await userService.verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !matches) throw ApiError.unauthorized(INVALID_LOGIN);
    if (!user.isActive) throw ApiError.unauthorized('This account is deactivated');

    const context = await userService.getAuthContext(user._id);
    if (!context.roleId?.isActive) throw ApiError.unauthorized('Your role is deactivated');

    await userService.recordLogin(user._id);
    return { token: signToken(user._id), expiresIn: env.JWT_EXPIRES_IN, user: toAuthUser(context) };
  },

  // Turns a token into the logged-in user, or throws 401.
  async verify(token) {
    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw ApiError.unauthorized('Your session has expired. Please log in again.');
    }
    const user = await userService.getAuthContext(payload.sub);
    if (!user || !user.isActive || !user.roleId?.isActive) {
      throw ApiError.unauthorized('Account not found or deactivated');
    }
    // Tokens issued before the last password change stop working.
    const changedAt = user.passwordChangedAt
      ? Math.floor(user.passwordChangedAt.getTime() / 1000)
      : 0;
    if (payload.iat < changedAt) {
      throw ApiError.unauthorized('Your password was changed. Please log in again.');
    }
    return toAuthUser(user);
  },

  async me(userId) {
    return toAuthUser(await userService.getAuthContext(userId));
  },

  // Returns a fresh token, because the old one stops working after the change.
  async changePassword(userId, currentPassword, newPassword) {
    await userService.changeOwnPassword(userId, currentPassword, newPassword);
    return { token: signToken(userId), expiresIn: env.JWT_EXPIRES_IN };
  },
};
