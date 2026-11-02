import mongoose from 'mongoose';
import { ApiError } from '#shared/utils/ApiError.js';
import { sumMoney } from '#shared/utils/money.js';
import { buildMeta, dateRangeFilter, paginate, parseSort } from '#shared/utils/pagination.js';
import { inTransaction } from '#shared/db/transaction.js';
import { nextSequence } from '#shared/db/counter.js';
import { branchDocNo } from '#shared/utils/docNumber.js';
import { itemService } from '#modules/items/index.js';
import { branchService } from '#modules/branches/index.js';
import { settingService } from '#modules/settings/index.js';
import { accountService, SYSTEM_KEYS } from '#modules/accounts/index.js';
import { voucherService } from '#modules/vouchers/index.js';
import { approvalService } from '#modules/approvals/index.js';
import { inventoryRepository as repo } from './inventory.repository.js';
import { inventoryService } from './inventory.service.js';

const canApproveDirectly = (user) => user.role.isSuperAdmin || user.role.canApprove;

export const adjustmentService = {
  // Approvers' adjustments apply at once; everyone else's wait in the approval queue.
  create(input, ctx) {
    return inTransaction(null, async (session) => {
      const branchId = ctx.scope.writeBranch(input.branchId);
      const branch = await branchService.getActive(branchId, session);
      await settingService.assertPeriodOpen(input.date, session);
      const godown = await inventoryService.resolveGodown(branchId, input.godownId, session);
      const items = await itemService.getActiveMany(
        input.items.map((i) => i.itemId),
        session,
      );

      const seq = await nextSequence(`adjustment:${branchId}`, session);
      const adjustment = await repo.createAdjustment(
        {
          adjustmentNo: branchDocNo('ADJ', seq, branch.code, input.date),
          date: input.date,
          branchId,
          godownId: godown._id,
          reason: input.reason,
          notes: input.notes,
          items: input.items.map((i) => ({ ...i, itemName: items.get(i.itemId).name })),
          createdBy: ctx.user.id,
          updatedBy: ctx.user.id,
        },
        session,
      );

      if (canApproveDirectly(ctx.user)) {
        return adjustmentService.apply(adjustment, ctx, session);
      }
      const request = await approvalService.createRequest(
        {
          type: 'stock_adjustment',
          branchId,
          title: `Stock adjustment ${adjustment.adjustmentNo} (${input.reason})`,
          payload: { adjustmentId: String(adjustment._id) },
        },
        ctx.user,
        session,
      );
      adjustment.approvalId = request._id;
      await adjustment.save({ session });
      return adjustment;
    });
  },

  // Moves the stock and posts the journal:
  //   stock added:   Dr Stock / Cr Stock Adjustment
  //   stock removed: Dr Stock Adjustment / Cr Stock
  async apply(adjustment, ctx, session) {
    await settingService.assertPeriodOpen(adjustment.date, session);
    const branch = await branchService.getActive(adjustment.branchId, session);
    const voucherId = new mongoose.Types.ObjectId();
    const voucherNo = await voucherService.reserveNumber(
      'journal',
      branch,
      adjustment.date,
      session,
    );
    const ref = { type: 'voucher', id: voucherId, no: voucherNo };

    const movements = await inventoryService.applyMovements(
      adjustment.items.map((i) => ({
        type: i.qtyChange > 0 ? 'adjust_in' : 'adjust_out',
        itemId: i.itemId,
        qty: Math.abs(i.qtyChange),
        unitCost: i.qtyChange > 0 ? i.unitCost : undefined,
        godownId: adjustment.godownId,
        branchId: adjustment.branchId,
        date: adjustment.date,
        ref,
        notes: `${adjustment.adjustmentNo} — ${adjustment.reason}`,
      })),
      { session, userId: ctx.user.id },
    );

    const added = sumMoney(movements.filter((m) => m.direction === 'in').map((m) => m.value));
    const removed = sumMoney(movements.filter((m) => m.direction === 'out').map((m) => m.value));
    const stock = await accountService.getSystem(SYSTEM_KEYS.STOCK, { session });
    const adjust = await accountService.getSystem(SYSTEM_KEYS.STOCK_ADJUSTMENT, { session });
    const lines = [];
    if (added > 0)
      lines.push({ accountId: stock._id, debit: added }, { accountId: adjust._id, credit: added });
    if (removed > 0)
      lines.push(
        { accountId: adjust._id, debit: removed },
        { accountId: stock._id, credit: removed },
      );

    if (lines.length) {
      await voucherService.postVoucher(
        {
          vType: 'journal',
          date: adjustment.date,
          branchId: String(adjustment.branchId),
          narration: `Stock adjustment ${adjustment.adjustmentNo} (${adjustment.reason})`,
          lines,
        },
        ctx,
        {
          session,
          source: 'inventory',
          voucherId,
          voucherNo,
          godownId: adjustment.godownId,
          sourceRef: {
            refType: 'stock_adjustment',
            refId: adjustment._id,
            refNo: adjustment.adjustmentNo,
          },
        },
      );
      adjustment.voucherId = voucherId;
    }
    adjustment.items.forEach((item, index) => {
      item.unitCost = movements[index].unitCost;
    });
    adjustment.status = 'approved';
    adjustment.decidedBy = ctx.user.id;
    adjustment.decidedAt = new Date();
    adjustment.updatedBy = ctx.user.id;
    await adjustment.save({ session });
    return adjustment;
  },

  async loadPending(id, session) {
    const adjustment = await repo.findAdjustmentById(id, session);
    if (!adjustment) throw ApiError.notFound('Stock adjustment not found');
    if (adjustment.status !== 'pending') {
      throw ApiError.conflict(`This adjustment is already ${adjustment.status}`);
    }
    return adjustment;
  },

  async list(query, scope) {
    const { page, limit, skip } = paginate(query);
    const filter = { ...scope.filter(), ...dateRangeFilter(query) };
    if (query.status) filter.status = query.status;
    const sort = parseSort(query.sort, ['date', 'createdAt'], { date: -1, createdAt: -1 });
    const [items, total] = await Promise.all([
      repo.findAdjustments(filter, { skip, limit, sort }),
      repo.countAdjustments(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },

  async getById(id, scope) {
    const adjustment = await repo.findAdjustmentById(id);
    if (!adjustment) throw ApiError.notFound('Stock adjustment not found');
    scope.assertAccess(adjustment.branchId);
    return adjustment;
  },
};
