import mongoose from 'mongoose';
import { ApiError } from '#shared/utils/ApiError.js';
import { round2, round4, sumMoney } from '#shared/utils/money.js';
import { buildMeta, dateRangeFilter, paginate, parseSort } from '#shared/utils/pagination.js';
import { inTransaction } from '#shared/db/transaction.js';
import { periodOf } from '#shared/utils/dates.js';
import { STOCK_IN_TYPES } from '#shared/constants/enums.js';
import { itemService } from '#modules/items/index.js';
import { masterServices } from '#modules/masters/index.js';
import { settingService } from '#modules/settings/index.js';
import { branchService } from '#modules/branches/index.js';
import { accountService, SYSTEM_KEYS } from '#modules/accounts/index.js';
import { voucherService } from '#modules/vouchers/index.js';
import { inventoryRepository as repo } from './inventory.repository.js';

const toId = (id) => new mongoose.Types.ObjectId(String(id));

export const inventoryService = {
  /**
   * The only way stock changes. Each entry:
   *   { type, itemId, godownId, branchId, qty, unitCost?, date, ref, notes }
   * Incoming stock re-calculates the moving average cost; outgoing stock leaves
   * at the current average (or at `unitCost` when given, e.g. purchase returns).
   * Must run inside a transaction (pass `session`). Returns the movements,
   * whose `unitCost` callers use for COGS.
   */
  async applyMovements(entries, { session, userId }) {
    if (!session) throw ApiError.internal('Stock movements must run inside a transaction');
    const items = await itemService.getActiveMany(
      entries.map((e) => e.itemId),
      session,
    );
    const godowns = await masterServices.godowns.getMany(
      [...new Set(entries.map((e) => String(e.godownId)))],
      session,
    );
    const allowNegative = await settingService.allowNegativeStock(session);

    const movements = [];
    for (const e of entries) {
      const godown = godowns.get(String(e.godownId));
      if (!godown?.isActive) throw ApiError.badRequest('Godown not found or inactive');
      if (String(godown.branchId) !== String(e.branchId)) {
        throw ApiError.badRequest(`Godown "${godown.name}" does not belong to this branch`);
      }
      const item = items.get(String(e.itemId));
      const balance = await repo.findBalance(e.itemId, e.godownId, session);
      const oldQty = balance?.qty ?? 0;
      const oldAvg = balance?.avgCost ?? 0;
      const qty = round4(e.qty);
      const isIn = STOCK_IN_TYPES.includes(e.type);

      let unitCost;
      let newQty;
      let newAvg;
      if (isIn) {
        unitCost = round4(e.unitCost ?? oldAvg);
        newQty = round4(oldQty + qty);
        // new average = (old value + incoming value) / new quantity
        newAvg =
          oldQty <= 0 || newQty <= 0 ? unitCost : (oldQty * oldAvg + qty * unitCost) / newQty;
      } else {
        if (!allowNegative && qty > oldQty) {
          throw ApiError.unprocessable(
            `Not enough stock of ${item.name} in ${godown.name}: ${oldQty} available, ${qty} needed`,
            {
              code: 'INSUFFICIENT_STOCK',
              itemId: String(item._id),
              available: oldQty,
              requested: qty,
            },
          );
        }
        unitCost = round4(e.unitCost ?? oldAvg);
        newQty = round4(oldQty - qty);
        newAvg = newQty > 0 ? Math.max(0, (oldQty * oldAvg - qty * unitCost) / newQty) : oldAvg;
      }
      newAvg = round4(newAvg);

      await repo.saveBalance(
        {
          itemId: item._id,
          godownId: godown._id,
          branchId: godown.branchId,
          productType: item.productType,
          qty: newQty,
          avgCost: newAvg,
          value: round2(newQty * newAvg),
        },
        session,
      );
      movements.push(
        await repo.createMovement(
          {
            date: e.date,
            period: periodOf(e.date),
            type: e.type,
            direction: isIn ? 'in' : 'out',
            itemId: item._id,
            itemName: item.name,
            unit: item.unit,
            productType: item.productType,
            branchId: godown.branchId,
            godownId: godown._id,
            qty,
            unitCost,
            value: round2(qty * unitCost),
            balanceQty: newQty,
            balanceAvgCost: newAvg,
            ref: e.ref,
            notes: e.notes,
            createdBy: userId,
            updatedBy: userId,
          },
          session,
        ),
      );
    }
    return movements;
  },

  // The branch's default godown, or the given one (which must belong to the branch).
  async resolveGodown(branchId, godownId, session) {
    if (godownId) {
      const godown = await masterServices.godowns.getActive(godownId, session);
      if (String(godown.branchId) !== String(branchId)) {
        throw ApiError.badRequest('This godown does not belong to the selected branch');
      }
      return godown;
    }
    const branch = await branchService.getActive(branchId, session);
    if (!branch.defaultGodownId) throw ApiError.badRequest('This branch has no default godown');
    return masterServices.godowns.getActive(branch.defaultGodownId, session);
  },

  // Current stock per item and godown, with item details. lowStock=true shows only
  // items at or below their reorder level.
  async listBalances(query, scope) {
    const { page, limit, skip } = paginate(query);
    const match = { ...scope.filter() };
    if (query.itemId) match.itemId = toId(query.itemId);
    if (query.godownId) match.godownId = toId(query.godownId);
    if (query.productType) match.productType = query.productType;
    if (!query.includeZero && !query.lowStock) match.qty = { $ne: 0 };

    const pipeline = [
      { $match: match },
      { $lookup: { from: 'items', localField: 'itemId', foreignField: '_id', as: 'item' } },
      { $unwind: '$item' },
      { $lookup: { from: 'godowns', localField: 'godownId', foreignField: '_id', as: 'godown' } },
      { $unwind: '$godown' },
    ];
    if (query.lowStock) {
      pipeline.push({
        $match: {
          $expr: {
            $and: [{ $gt: ['$item.reorderLevel', 0] }, { $lte: ['$qty', '$item.reorderLevel'] }],
          },
        },
      });
    }
    pipeline.push(
      { $sort: { 'item.name': 1, 'godown.name': 1 } },
      {
        $facet: {
          rows: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                itemId: 1,
                itemCode: '$item.itemCode',
                itemName: '$item.name',
                unit: '$item.unit',
                productType: 1,
                reorderLevel: '$item.reorderLevel',
                godownId: 1,
                godownName: '$godown.name',
                branchId: 1,
                qty: 1,
                avgCost: 1,
                value: 1,
              },
            },
          ],
          total: [{ $count: 'n' }],
        },
      },
    );
    const [result] = await repo.aggregateBalances(pipeline);
    return { items: result.rows, meta: buildMeta({ page, limit }, result.total[0]?.n ?? 0) };
  },

  // Stock per item across all godowns in the current view.
  async summaryByItem(query, scope) {
    const match = { ...scope.filter() };
    if (query.productType) match.productType = query.productType;
    const rows = await repo.aggregateBalances([
      { $match: match },
      {
        $group: {
          _id: '$itemId',
          qty: { $sum: '$qty' },
          value: { $sum: '$value' },
          productType: { $first: '$productType' },
        },
      },
      { $match: { qty: { $ne: 0 } } },
      { $lookup: { from: 'items', localField: '_id', foreignField: '_id', as: 'item' } },
      { $unwind: '$item' },
      { $sort: { 'item.name': 1 } },
      {
        $project: {
          _id: 0,
          itemId: '$_id',
          itemCode: '$item.itemCode',
          itemName: '$item.name',
          unit: '$item.unit',
          productType: 1,
          qty: 1,
          value: 1,
        },
      },
    ]);
    return rows.map((r) => ({
      ...r,
      qty: round4(r.qty),
      value: round2(r.value),
      avgCost: r.qty > 0 ? round4(r.value / r.qty) : 0,
    }));
  },

  // Stock value per product line (used by reports and dashboards).
  async valuation(scope) {
    const rows = await repo.aggregateBalances([
      { $match: { ...scope.filter() } },
      { $group: { _id: '$productType', qty: { $sum: '$qty' }, value: { $sum: '$value' } } },
      { $sort: { _id: 1 } },
    ]);
    const byProductType = rows.map((r) => ({
      productType: r._id,
      qty: round4(r.qty),
      value: round2(r.value),
    }));
    return { byProductType, totalValue: sumMoney(byProductType.map((r) => r.value)) };
  },

  async listMovements(query, scope) {
    const { page, limit, skip } = paginate(query);
    const filter = { ...scope.filter(), ...dateRangeFilter(query) };
    if (query.itemId) filter.itemId = query.itemId;
    if (query.godownId) filter.godownId = query.godownId;
    if (query.type) filter.type = query.type;
    const sort = parseSort(query.sort, ['date', 'createdAt'], { date: -1, createdAt: -1 });
    const [items, total] = await Promise.all([
      repo.findMovements(filter, { skip, limit, sort }),
      repo.countMovements(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },

  /**
   * Opening stock (frontend: Stock In / opening balances). Adds the stock and posts
   * Dr Stock / Cr Opening Balance Equity, in one transaction.
   */
  postOpeningStock(input, ctx) {
    return inTransaction(null, async (session) => {
      const branchId = ctx.scope.writeBranch(input.branchId);
      const branch = await branchService.getActive(branchId, session);
      await settingService.assertPeriodOpen(input.date, session);
      const godown = await inventoryService.resolveGodown(branchId, input.godownId, session);

      const voucherId = new mongoose.Types.ObjectId();
      const voucherNo = await voucherService.reserveNumber('journal', branch, input.date, session);
      const movements = await inventoryService.applyMovements(
        input.items.map((i) => ({
          type: 'opening',
          itemId: i.itemId,
          qty: i.qty,
          unitCost: i.unitCost,
          godownId: godown._id,
          branchId,
          date: input.date,
          ref: { type: 'voucher', id: voucherId, no: voucherNo },
          notes: input.notes,
        })),
        { session, userId: ctx.user.id },
      );

      const total = sumMoney(movements.map((m) => m.value));
      let voucher = null;
      if (total > 0) {
        const stock = await accountService.getSystem(SYSTEM_KEYS.STOCK, { session });
        const equity = await accountService.getSystem(SYSTEM_KEYS.OPENING_EQUITY, { session });
        ({ voucher } = await voucherService.postVoucher(
          {
            vType: 'journal',
            date: input.date,
            branchId,
            narration: input.notes || `Opening stock — ${godown.name}`,
            lines: [
              { accountId: stock._id, debit: total },
              { accountId: equity._id, credit: total },
            ],
          },
          ctx,
          {
            session,
            source: 'inventory',
            voucherId,
            voucherNo,
            godownId: godown._id,
            items: movements.map((m) => ({
              itemId: m.itemId,
              itemName: m.itemName,
              unit: m.unit,
              qty: m.qty,
              unitCost: m.unitCost,
              costAmount: m.value,
            })),
          },
        ));
      }
      return { movements, voucher };
    });
  },
};
