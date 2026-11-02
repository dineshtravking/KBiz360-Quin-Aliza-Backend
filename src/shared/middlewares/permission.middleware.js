import { ApiError } from '#shared/utils/ApiError.js';

export function hasPermission(user, permission) {
  const role = user?.role;
  if (!role) return false;
  return role.isSuperAdmin || role.permissions.includes(permission);
}

// Route guard: the user needs at least ONE of the listed permissions.
export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (permissions.some((p) => hasPermission(req.user, p))) return next();
    next(ApiError.forbidden());
  };
}

// Read-only roles (Owner) can browse everything but never change data.
export function blockReadOnly(req, res, next) {
  if (req.user?.role?.isReadOnly && req.method !== 'GET') {
    return next(ApiError.forbidden('View-only account — changes are not allowed'));
  }
  next();
}
