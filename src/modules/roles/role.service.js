import { ApiError } from '#shared/utils/ApiError.js';
import { buildMeta, paginate, parseSort, searchFilter } from '#shared/utils/pagination.js';
import { ALL_PERMISSIONS } from '#shared/constants/permissions.js';
import { roleRepository } from './role.repository.js';
import { BUILT_IN_ROLES } from './role.constants.js';

export const roleService = {
  async list(query) {
    const { page, limit, skip } = paginate(query);
    const filter = searchFilter(query.search, ['name', 'description']);
    if (query.isActive !== 'all') filter.isActive = query.isActive === 'true';
    const sort = parseSort(query.sort, ['name', 'createdAt'], { name: 1 });
    const [items, total] = await Promise.all([
      roleRepository.find(filter, { skip, limit, sort }),
      roleRepository.count(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },

  async getById(id) {
    const role = await roleRepository.findById(id);
    if (!role) throw ApiError.notFound('Role not found');
    return role;
  },

  async getActive(id) {
    const role = await roleRepository.findById(id);
    if (!role || !role.isActive) throw ApiError.badRequest('Role not found or inactive');
    return role;
  },

  listPermissions: () => ALL_PERMISSIONS,

  create(data, user) {
    return roleRepository.create({ ...data, createdBy: user.id, updatedBy: user.id });
  },

  async update(id, data, user) {
    const role = await roleService.getById(id);
    if (role.isSuperAdmin) throw ApiError.unprocessable('The Super Admin role cannot be changed');
    return roleRepository.update(id, { ...data, updatedBy: user.id });
  },

  async setActive(id, isActive, user) {
    const role = await roleService.getById(id);
    if (role.isBuiltIn && !isActive) {
      throw ApiError.unprocessable('Built-in roles cannot be deactivated');
    }
    return roleRepository.update(id, { isActive, updatedBy: user.id });
  },

  async ensureBuiltInRoles() {
    const roles = {};
    for (const def of BUILT_IN_ROLES) {
      roles[def.key] = await roleRepository.upsertBuiltIn({ ...def, isBuiltIn: true });
    }
    return roles;
  },
};
