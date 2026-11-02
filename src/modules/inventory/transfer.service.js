import mongoose from 'mongoose';
import { ApiError } from '#shared/utils/ApiError.js';
import { buildMeta, dateRangeFilter, paginate, parseSort } from '#shared/utils/pagination.js';
import { inTransaction } from '#shared/db/transaction.js';
import { nextSequence } from '#shared/db/counter.js';
import { transferNo } from '#shared/utils/docNumber.js';
import { itemService } from '#modules/items/index.js';
import { masterServices } from '#modules/masters/index.js';
import { branchService } from '#modules/branches/index.js';
import { settingService } from '#modules/settings/index.js';
import { inventoryRepository as repo } from './inventory.repository.js';
import { inventoryService } from './inventory.service.js';

const toId = (id) => new mongoose.Types.ObjectId(String(id));

async function loadPending(id, session) {
  const transfer = await repo.findTransferById(id, session);
  if (!transfer) throw ApiError.notFound('Transfer not found');
  if (transfer.status !== 'pending')
    throw ApiError.conflict(`This transfer is already ${transfer.status}`);
  return transfer;
}

// No accounting entry: stock stays in the same company-wide Stock account,
// only its location changes.
export const transferService = {
  async create(input, ctx) {
    const from = await masterServices.godowns.getActive(input.fromGodownId);
    const to = await masterServices.godowns.getActive(input.toGodownId);
    ctx.scope.assertAccess(from.branchId);
    const [fromBranch, toBranch] = await Promise.all([
      branchService.getActive(from.branchId),
      branchService.getActive(to.branchId),
    ]);
    const items = await itemService.getActiveMany(input.items.map((i) => i.itemId));

    // Early warning only — the real check happens when stock moves (on approval).
    if (!(await settingService.allowNegativeStock())) {
      for (const line of input.items) {
        const available = (await repo.findBalance(line.itemId, from._id))?.qty ?? 0;
        if (line.qty > available) {
          throw ApiError.unprocessable(
            `Not enough stock of ${items.get(line.itemId).name} in ${from.name}: ${available} available`,
            { code: 'INSUFFICIENT_STOCK', itemId: line.itemId, available, requested: line.qty },
          );
        }
      }
    }

    const seq = await nextSequence('transfer');
    return repo.createTransfer({
      transferNo: transferNo(seq, fromBranch.code, toBranch.code, input.date),
      date: input.date,
      fromBranchId: from.branchId,
      fromGodownId: from._id,
      toBranchId: to.branchId,
      toGodownId: to._id,
      items: input.items.map((i) => ({
        itemId: i.itemId,
        itemName: items.get(i.itemId).name,
        unit: items.get(i.itemId).unit,
        qty: i.qty,
      })),
      notes: input.notes,
      createdBy: ctx.user.id,
      updatedBy: ctx.user.id,
    });
  },

  // The receiving side (or Head Office) approves; stock then leaves the source
  // godown at its average cost and arrives at the destination at the same cost.
  approve(id, ctx) {
    return inTransaction(null, async (session) => {
      const transfer = await loadPending(id, session);
      ctx.scope.assertAccess(transfer.toBranchId);
      await settingService.assertPeriodOpen(transfer.date, session);
      const ref = { type: 'transfer', id: transfer._id, no: transfer.transferNo };

      const outs = await inventoryService.applyMovements(
        transfer.items.map((i) => ({
          type: 'transfer_out',
          itemId: i.itemId,
          qty: i.qty,
          godownId: transfer.fromGodownId,
          branchId: transfer.fromBranchId,
          date: transfer.date,
          ref,
        })),
        { session, userId: ctx.user.id },
      );
      await inventoryService.applyMovements(
        transfer.items.map((i, index) => ({
          type: 'transfer_in',
          itemId: i.itemId,
          qty: i.qty,
          unitCost: outs[index].unitCost,
          godownId: transfer.toGodownId,
          branchId: transfer.toBranchId,
          date: transfer.date,
          ref,
        })),
        { session, userId: ctx.user.id },
      );

      transfer.items.forEach((item, index) => {
        item.unitCost = outs[index].unitCost;
      });
      transfer.status = 'approved';
      transfer.approvedBy = ctx.user.id;
      transfer.approvedAt = new Date();
      transfer.updatedBy = ctx.user.id;
      await transfer.save({ session });
      return transfer;
    });
  },

  async reject(id, reason, ctx) {
    const transfer = await loadPending(id);
    ctx.scope.assertAccess(transfer.toBranchId);
    Object.assign(transfer, {
      status: 'rejected',
      rejectionReason: reason,
      rejectedBy: ctx.user.id,
      rejectedAt: new Date(),
      updatedBy: ctx.user.id,
    });
    return transfer.save();
  },

  // The sending side can take back a transfer that is still pending.
  async cancel(id, ctx) {
    const transfer = await loadPending(id);
    ctx.scope.assertAccess(transfer.fromBranchId);
    transfer.status = 'cancelled';
    transfer.updatedBy = ctx.user.id;
    return transfer.save();
  },

  // direction=in → coming to the active branch, out → leaving it.
  async list(query, scope) {
    const { page, limit, skip } = paginate(query);
    const filter = { ...dateRangeFilter(query) };
    if (query.status) filter.status = query.status;

    const branchIds = scope.activeBranchId
      ? [toId(scope.activeBranchId)]
      : scope.allowedBranchIds?.map(toId);
    if (branchIds) {
      const inside = { $in: branchIds };
      if (query.direction === 'in') filter.toBranchId = inside;
      else if (query.direction === 'out') filter.fromBranchId = inside;
      else filter.$or = [{ fromBranchId: inside }, { toBranchId: inside }];
    }
    const sort = parseSort(query.sort, ['date', 'createdAt'], { date: -1, createdAt: -1 });
    const [items, total] = await Promise.all([
      repo.findTransfers(filter, { skip, limit, sort }),
      repo.countTransfers(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },

  async getById(id, scope) {
    const transfer = await repo.findTransferById(id);
    if (!transfer) throw ApiError.notFound('Transfer not found');
    if (!scope.canAccess(transfer.fromBranchId) && !scope.canAccess(transfer.toBranchId)) {
      throw ApiError.forbidden('You do not have access to this transfer');
    }
    return transfer;
  },
};
