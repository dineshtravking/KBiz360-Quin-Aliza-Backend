import mongoose from 'mongoose';
import { ApiError } from '#shared/utils/ApiError.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;
const toId = (id) => new mongoose.Types.ObjectId(String(id));

// The frontend has three views: Group (all branches), Head Office, one Branch.
// The client picks the view with the `X-Branch-Id` header (no header = Group view).
// This middleware works out which branches the user may see and puts a
// helper on `req.scope` that every service uses to filter and check branch data.
export function branchScope(req, res, next) {
  const user = req.user;
  const seesAll = user.role.isSuperAdmin || user.branchMode === 'all';
  const allowed = seesAll ? null : user.branchIds.map(String);

  const header = req.get('x-branch-id');
  if (header && !OBJECT_ID.test(header)) {
    return next(ApiError.badRequest('X-Branch-Id header must be a valid branch id'));
  }
  if (header && allowed && !allowed.includes(header)) {
    return next(ApiError.forbidden('You do not have access to this branch'));
  }

  // A user tied to exactly one branch always works in that branch.
  const active = header || (allowed?.length === 1 ? allowed[0] : null);
  req.scope = createScope(allowed, active);
  next();
}

export function createScope(allowedBranchIds, activeBranchId) {
  const canAccess = (branchId) => !allowedBranchIds || allowedBranchIds.includes(String(branchId));

  const assertAccess = (branchId) => {
    if (!canAccess(branchId)) throw ApiError.forbidden('You do not have access to this branch');
  };

  return {
    activeBranchId,
    allowedBranchIds,
    isGroupView: !activeBranchId,
    canAccess,
    assertAccess,

    // Mongo filter for branch-owned data in the current view.
    filter(field = 'branchId') {
      if (activeBranchId) return { [field]: toId(activeBranchId) };
      if (allowedBranchIds) return { [field]: { $in: allowedBranchIds.map(toId) } };
      return {};
    },

    // Which branch a new record belongs to. Group view cannot create branch data.
    writeBranch(branchId) {
      const target = branchId ?? activeBranchId;
      if (!target) {
        throw ApiError.badRequest(
          'Choose a branch first (send branchId or the X-Branch-Id header)',
        );
      }
      assertAccess(target);
      return String(target);
    },
  };
}

// Full access, used by scripts and system jobs.
export const systemScope = () => createScope(null, null);
