// Every permission in the system. Roles hold a list of these strings and
// requirePermission() checks them on each route.

export const PERMISSIONS = Object.freeze({
  USERS_VIEW: 'users:view',
  USERS_MANAGE: 'users:manage',
  ROLES_VIEW: 'roles:view',
  ROLES_MANAGE: 'roles:manage',
  BRANCHES_VIEW: 'branches:view',
  BRANCHES_MANAGE: 'branches:manage',
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_MANAGE: 'settings:manage',
  MASTERS_VIEW: 'masters:view',
  MASTERS_MANAGE: 'masters:manage',
  ITEMS_VIEW: 'items:view',
  ITEMS_MANAGE: 'items:manage',
  ACCOUNTS_VIEW: 'accounts:view',
  ACCOUNTS_MANAGE: 'accounts:manage',
  VOUCHERS_VIEW: 'vouchers:view',
  VOUCHERS_CREATE: 'vouchers:create',
  VOUCHERS_VOID: 'vouchers:void',
  APPROVALS_VIEW: 'approvals:view',
  APPROVALS_DECIDE: 'approvals:decide',
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_MANAGE: 'inventory:manage',
  INVENTORY_APPROVE: 'inventory:approve',
  SALES_VIEW: 'sales:view',
  SALES_CREATE: 'sales:create',
  SALES_RETURN: 'sales:return',
  PURCHASES_VIEW: 'purchases:view',
  PURCHASES_CREATE: 'purchases:create',
  IMPORTS_VIEW: 'imports:view',
  IMPORTS_MANAGE: 'imports:manage',
  IMPORTS_VOID: 'imports:void',
  HR_VIEW: 'hr:view',
  HR_MANAGE: 'hr:manage',
  HR_APPROVE: 'hr:approve',
  PAYROLL_MANAGE: 'payroll:manage',
  REPORTS_VIEW: 'reports:view',
  AUDIT_VIEW: 'audit:view',
});

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);
export const VIEW_PERMISSIONS = ALL_PERMISSIONS.filter((p) => p.endsWith(':view'));
