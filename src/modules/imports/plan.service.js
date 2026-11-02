import { ApiError } from '#shared/utils/ApiError.js';
import { round4 } from '#shared/utils/money.js';
import { buildMeta, paginate, parseSort, searchFilter } from '#shared/utils/pagination.js';
import { nextSequence } from '#shared/db/counter.js';
import { planNo } from '#shared/utils/docNumber.js';
import { itemService } from '#modules/items/index.js';
import { masterServices } from '#modules/masters/index.js';
import { branchService } from '#modules/branches/index.js';
import { importsRepository as repo } from './imports.repository.js';
import { shipmentService } from './shipment.service.js';

async function loadPlan(id, scope) {
  const plan = await repo.findPlanById(id);
  if (!plan) throw ApiError.notFound('Import plan not found');
  scope.assertAccess(plan.branchId);
  return plan;
}

async function resolve(input) {
  const out = {};
  if (input.supplierId)
    out.supplierName = (await masterServices.suppliers.getActive(input.supplierId)).name;
  if (input.items) {
    const items = await itemService.getActiveMany(input.items.map((i) => i.itemId));
    out.items = input.items.map((i) => ({
      ...i,
      itemName: items.get(i.itemId).name,
      unit: items.get(i.itemId).unit,
    }));
  }
  return out;
}

export const planService = {
  async list(query, scope) {
    const { page, limit, skip } = paginate(query);
    const filter = {
      ...scope.filter(),
      ...searchFilter(query.search, ['planNo', 'name', 'supplierName']),
    };
    if (query.route) filter.route = query.route;
    if (query.status) filter.status = query.status;
    const sort = parseSort(query.sort, ['createdDate', 'planNo', 'createdAt'], { createdDate: -1 });
    const [items, total] = await Promise.all([
      repo.findPlans(filter, { skip, limit, sort }),
      repo.countPlans(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },

  // Plan with progress per item: ordered on shipments vs received.
  async getById(id, scope) {
    const plan = await loadPlan(id, scope);
    const shipments = await shipmentService.findForPlan(plan._id);
    const progress = plan.items.map((line) => {
      const lines = shipments.flatMap((s) =>
        s.items.filter((i) => String(i.itemId) === String(line.itemId)),
      );
      const orderedQty = round4(lines.reduce((sum, i) => sum + i.qty, 0));
      const receivedQty = round4(lines.reduce((sum, i) => sum + (i.receivedQty ?? 0), 0));
      return {
        itemId: line.itemId,
        itemName: line.itemName,
        plannedQty: line.plannedQty,
        orderedQty,
        receivedQty,
        remainingQty: round4(Math.max(0, line.plannedQty - orderedQty)),
      };
    });
    return {
      ...plan.toJSON(),
      progress,
      shipments: shipments.map((s) => ({
        id: String(s._id),
        shipmentNo: s.shipmentNo,
        status: s.status,
      })),
      isFullyOrdered: progress.every((p) => p.remainingQty === 0),
    };
  },

  async create(input, ctx) {
    const branchId = ctx.scope.writeBranch(input.branchId);
    await branchService.getActive(branchId);
    const seq = await nextSequence(`plan:${input.route}`);
    return repo.createPlan({
      ...input,
      ...(await resolve(input)),
      branchId,
      planNo: planNo(input.route, seq, input.createdDate),
      createdBy: ctx.user.id,
      updatedBy: ctx.user.id,
    });
  },

  async update(id, input, ctx) {
    const plan = await loadPlan(id, ctx.scope);
    if (plan.status !== 'active') throw ApiError.unprocessable(`This plan is ${plan.status}`);
    Object.assign(plan, input, await resolve(input), { updatedBy: ctx.user.id });
    return plan.save();
  },

  async setStatus(id, status, ctx) {
    const plan = await loadPlan(id, ctx.scope);
    if (plan.status !== 'active')
      throw ApiError.unprocessable(`This plan is already ${plan.status}`);
    plan.status = status;
    plan.updatedBy = ctx.user.id;
    return plan.save();
  },
};
