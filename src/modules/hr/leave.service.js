import { ApiError } from '#shared/utils/ApiError.js';
import { buildMeta, paginate, parseSort } from '#shared/utils/pagination.js';
import { nextSequence } from '#shared/db/counter.js';
import { simpleNo } from '#shared/utils/docNumber.js';
import { daysBetween } from '#shared/utils/dates.js';
import { masterServices } from '#modules/masters/index.js';
import { leaveRepository as repo } from './hr.repository.js';
import { staffService } from './staff.service.js';

async function loadPending(id, scope) {
  const request = await repo.findById(id);
  if (!request) throw ApiError.notFound('Leave request not found');
  scope.assertAccess(request.branchId);
  if (request.status !== 'pending')
    throw ApiError.conflict(`This request is already ${request.status}`);
  return request;
}

export const leaveService = {
  async create(input, ctx) {
    const staff = await staffService.getActive(input.staffId, ctx.scope);
    const leaveType = await masterServices.leaveTypes.getActive(input.leaveTypeId);
    const overlap = await repo.findOne({
      staffId: staff._id,
      status: { $in: ['pending', 'approved'] },
      fromDate: { $lte: input.toDate },
      toDate: { $gte: input.fromDate },
    });
    if (overlap)
      throw ApiError.conflict(
        `${staff.name} already has leave ${overlap.requestNo} on these dates`,
      );

    return repo.create({
      ...input,
      requestNo: simpleNo('LV', await nextSequence('leave'), 5),
      staffName: staff.name,
      branchId: staff.branchId,
      leaveTypeName: leaveType.name,
      days: daysBetween(input.fromDate, input.toDate) + 1,
      createdBy: ctx.user.id,
      updatedBy: ctx.user.id,
    });
  },

  async decide(id, status, note, ctx) {
    const request = await loadPending(id, ctx.scope);
    Object.assign(request, {
      status,
      decisionNote: note,
      decidedBy: ctx.user.id,
      decidedAt: new Date(),
      updatedBy: ctx.user.id,
    });
    return request.save();
  },

  async cancel(id, ctx) {
    const request = await loadPending(id, ctx.scope);
    request.status = 'cancelled';
    request.updatedBy = ctx.user.id;
    return request.save();
  },

  async list(query, scope) {
    const { page, limit, skip } = paginate(query);
    const filter = { ...scope.filter() };
    if (query.status) filter.status = query.status;
    if (query.staffId) filter.staffId = query.staffId;
    const sort = parseSort(query.sort, ['fromDate', 'createdAt'], { fromDate: -1 });
    const [items, total] = await Promise.all([
      repo.find(filter, { skip, limit, sort }),
      repo.count(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },
};
