import mongoose from 'mongoose';
import { ApiError } from '#shared/utils/ApiError.js';
import { buildMeta, dateRangeFilter, paginate, parseSort } from '#shared/utils/pagination.js';
import { attendanceRepository as repo, staffRepository } from './hr.repository.js';
import { ATTENDANCE_STATUS } from './hr.models.js';

const toId = (id) => new mongoose.Types.ObjectId(String(id));

export const attendanceService = {
  // Saves the whole day's sheet for a branch (replaces what was there).
  async save(input, ctx) {
    const branchId = ctx.scope.writeBranch(input.branchId);
    const ids = input.records.map((r) => r.staffId);
    const staff = await staffRepository.findAll({ _id: { $in: ids }, branchId });
    const names = new Map(staff.map((s) => [String(s._id), s.name]));
    const unknown = ids.filter((id) => !names.has(id));
    if (unknown.length) {
      throw ApiError.badRequest('Some staff are not in this branch', { staffIds: unknown });
    }
    return repo.upsert(branchId, input.date, {
      records: input.records.map((r) => ({ ...r, staffName: names.get(r.staffId) })),
      updatedBy: ctx.user.id,
    });
  },

  async list(query, scope) {
    const { page, limit, skip } = paginate(query);
    const filter = { ...scope.filter(), ...dateRangeFilter(query) };
    if (query.branchId) {
      scope.assertAccess(query.branchId);
      filter.branchId = query.branchId;
    }
    const sort = parseSort(query.sort, ['date'], { date: -1 });
    const [items, total] = await Promise.all([
      repo.find(filter, { skip, limit, sort }),
      repo.count(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },

  // Days per status per staff member for one month.
  async monthlySummary({ month, branchId }, scope) {
    const match = { ...scope.filter(), date: { $regex: `^${month}-` } };
    if (branchId) {
      scope.assertAccess(branchId);
      match.branchId = toId(branchId);
    }
    const rows = await repo.aggregate([
      { $match: match },
      { $unwind: '$records' },
      {
        $group: {
          _id: { staffId: '$records.staffId', status: '$records.status' },
          staffName: { $first: '$records.staffName' },
          days: { $sum: 1 },
        },
      },
    ]);
    const byStaff = new Map();
    for (const row of rows) {
      const key = String(row._id.staffId);
      const entry = byStaff.get(key) ?? {
        staffId: key,
        staffName: row.staffName,
        ...Object.fromEntries(ATTENDANCE_STATUS.map((s) => [s, 0])),
      };
      entry[row._id.status] = row.days;
      byStaff.set(key, entry);
    }
    return [...byStaff.values()].sort((a, b) => a.staffName.localeCompare(b.staffName));
  },
};
