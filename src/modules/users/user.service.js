import bcrypt from 'bcryptjs';
import { env } from '#config/env.js';
import { ApiError } from '#shared/utils/ApiError.js';
import { buildMeta, paginate, parseSort, searchFilter } from '#shared/utils/pagination.js';
import { roleService } from '#modules/roles/index.js';
import { branchService } from '#modules/branches/index.js';
import { userRepository } from './user.repository.js';

const hashPassword = (password) => bcrypt.hash(password, env.BCRYPT_ROUNDS);

// Only a Super Admin may create or edit another Super Admin.
async function assertCanAssignRole(roleId, actor) {
  const role = await roleService.getActive(roleId);
  if (role.isSuperAdmin && !actor.role.isSuperAdmin) {
    throw ApiError.forbidden('Only a Super Admin can give the Super Admin role');
  }
  return role;
}

async function assertCanEdit(user, actor) {
  const role = await roleService.getById(user.roleId);
  if (role.isSuperAdmin && !actor.role.isSuperAdmin) {
    throw ApiError.forbidden('Only a Super Admin can change a Super Admin user');
  }
}

export const userService = {
  async list(query) {
    const { page, limit, skip } = paginate(query);
    const filter = searchFilter(query.search, ['name', 'email', 'title']);
    if (query.isActive !== 'all') filter.isActive = query.isActive === 'true';
    if (query.roleId) filter.roleId = query.roleId;
    const sort = parseSort(query.sort, ['name', 'email', 'createdAt', 'lastLoginAt'], { name: 1 });
    const [items, total] = await Promise.all([
      userRepository.find(filter, { skip, limit, sort }),
      userRepository.count(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },

  async getById(id) {
    const user = await userRepository.findById(id);
    if (!user) throw ApiError.notFound('User not found');
    return user;
  },

  async create(data, actor) {
    await assertCanAssignRole(data.roleId, actor);
    if (data.branchMode === 'specific') await branchService.assertAllExist(data.branchIds);
    return userService.createInternal(data, actor.id);
  },

  // Also used by the seed script (no permission checks).
  async createInternal({ password, ...data }, actorId) {
    return userRepository.create({
      ...data,
      branchIds: data.branchMode === 'specific' ? data.branchIds : [],
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(),
      createdBy: actorId,
      updatedBy: actorId,
    });
  },

  async update(id, data, actor) {
    const user = await userService.getById(id);
    await assertCanEdit(user, actor);
    if (data.roleId) await assertCanAssignRole(data.roleId, actor);
    if (data.branchMode === 'specific') await branchService.assertAllExist(data.branchIds);
    if (data.branchMode === 'all') data.branchIds = [];
    return userRepository.update(id, { ...data, updatedBy: actor.id });
  },

  // Admin sets a new password; the user must change it at next login.
  async resetPassword(id, password, actor) {
    const user = await userService.getById(id);
    await assertCanEdit(user, actor);
    return userRepository.update(id, {
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(),
      mustChangePassword: true,
      updatedBy: actor.id,
    });
  },

  async setActive(id, isActive, actor) {
    const user = await userService.getById(id);
    if (!isActive && String(user._id) === String(actor.id)) {
      throw ApiError.unprocessable('You cannot deactivate your own account');
    }
    await assertCanEdit(user, actor);
    return userRepository.update(id, { isActive, updatedBy: actor.id });
  },

  // ── Used by the auth module ────────────────────────────────────────────────
  findForLogin: (email) => userRepository.findByEmailWithPassword(email.toLowerCase()),
  findByEmail: (email) => userRepository.findByEmail(email.toLowerCase()),
  getAuthContext: (id) => userRepository.findAuthContext(id),
  verifyPassword: (password, hash) => bcrypt.compare(password, hash),
  recordLogin: (id) => userRepository.update(id, { lastLoginAt: new Date() }),

  async changeOwnPassword(id, currentPassword, newPassword) {
    const user = await userRepository.findByIdWithPassword(id);
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw ApiError.badRequest('Current password is wrong');
    }
    if (currentPassword === newPassword) {
      throw ApiError.badRequest('The new password must be different');
    }
    return userRepository.update(id, {
      passwordHash: await hashPassword(newPassword),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    });
  },
};
