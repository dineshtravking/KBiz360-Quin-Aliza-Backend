import { ApiError } from '#shared/utils/ApiError.js';
import { buildMeta, paginate, parseSort, searchFilter } from '#shared/utils/pagination.js';
import { nextSequence } from '#shared/db/counter.js';
import { simpleNo } from '#shared/utils/docNumber.js';
import { hasPermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { branchService } from '#modules/branches/index.js';
import { staffRepository as repo } from './hr.repository.js';

const SENSITIVE = ['monthlySalary', 'allowances', 'bankAccount', 'nationalId'];

// Salary and ID details are only shown to users who run payroll.
function present(staff, user) {
  const json = staff.toJSON();
  if (!hasPermission(user, P.PAYROLL_MANAGE)) SENSITIVE.forEach((field) => delete json[field]);
  return json;
}

function stripSensitive(data, user) {
  if (hasPermission(user, P.PAYROLL_MANAGE)) return data;
  const clean = { ...data };
  SENSITIVE.forEach((field) => delete clean[field]);
  return clean;
}

export const staffService = {
  async list(query, ctx) {
    const { page, limit, skip } = paginate(query);
    const filter = {
      ...ctx.scope.filter(),
      ...searchFilter(query.search, ['name', 'staffNo', 'designation']),
    };
    if (query.isActive !== 'all') filter.isActive = query.isActive === 'true';
    if (query.branchId) {
      ctx.scope.assertAccess(query.branchId);
      filter.branchId = query.branchId;
    }
    if (query.department) filter.department = query.department;
    const sort = parseSort(query.sort, ['name', 'staffNo', 'joinDate'], { name: 1 });
    const [rows, total] = await Promise.all([
      repo.find(filter, { skip, limit, sort }),
      repo.count(filter),
    ]);
    return {
      items: rows.map((s) => present(s, ctx.user)),
      meta: buildMeta({ page, limit }, total),
    };
  },

  async load(id, scope, session) {
    const staff = await repo.findById(id, session);
    if (!staff) throw ApiError.notFound('Staff member not found');
    scope.assertAccess(staff.branchId);
    return staff;
  },

  async getActive(id, scope, session) {
    const staff = await staffService.load(id, scope, session);
    if (!staff.isActive) throw ApiError.badRequest(`${staff.name} is inactive`);
    return staff;
  },

  async getById(id, ctx) {
    return present(await staffService.load(id, ctx.scope), ctx.user);
  },

  async create(input, ctx) {
    const branchId = ctx.scope.writeBranch(input.branchId);
    await branchService.getActive(branchId);
    const staffNo = simpleNo('EMP', await nextSequence('staff'));
    const staff = await repo.create({
      ...stripSensitive(input, ctx.user),
      branchId,
      staffNo,
      createdBy: ctx.user.id,
      updatedBy: ctx.user.id,
    });
    return present(staff, ctx.user);
  },

  async update(id, input, ctx) {
    await staffService.load(id, ctx.scope);
    if (input.branchId) ctx.scope.assertAccess(input.branchId);
    const staff = await repo.update(id, {
      ...stripSensitive(input, ctx.user),
      updatedBy: ctx.user.id,
    });
    return present(staff, ctx.user);
  },

  async setActive(id, isActive, ctx) {
    await staffService.load(id, ctx.scope);
    return present(await repo.update(id, { isActive, updatedBy: ctx.user.id }), ctx.user);
  },

  activeInBranch: (branchId, session) => repo.findAll({ branchId, isActive: true }, session),
};
