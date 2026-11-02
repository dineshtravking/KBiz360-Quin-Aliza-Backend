import mongoose from 'mongoose';
import { ApiError } from '#shared/utils/ApiError.js';
import { multiply, round2, round4, sumMoney } from '#shared/utils/money.js';
import {
  buildMeta,
  dateRangeFilter,
  paginate,
  parseSort,
  searchFilter,
} from '#shared/utils/pagination.js';
import { inTransaction } from '#shared/db/transaction.js';
import { nextSequence } from '#shared/db/counter.js';
import { shipmentNo } from '#shared/utils/docNumber.js';
import { accountService, SYSTEM_KEYS as K } from '#modules/accounts/index.js';
import { branchService } from '#modules/branches/index.js';
import { settingService } from '#modules/settings/index.js';
import { itemService } from '#modules/items/index.js';
import { masterServices } from '#modules/masters/index.js';
import { inventoryService } from '#modules/inventory/index.js';
import { voucherService } from '#modules/vouchers/index.js';
import { importsRepository as repo } from './imports.repository.js';
import { CHARGE_KEYS, DELIVERED, ROUTE_PREFIX, ROUTE_STAGES } from './imports.constants.js';

// ── Pure calculations ─────────────────────────────────────────────────────────

// FOB, charges, landed cost, margin and amount paid (frontend: calcTotals).
export function computeTotals(shipment) {
  const rate = shipment.currency === 'USD' ? 1 : shipment.exchangeRate || 1;
  const fobForeign = sumMoney(shipment.items.map((i) => multiply(i.qty, i.fobPrice)));
  const fobUSD = sumMoney(shipment.items.map((i) => round2((i.qty * i.fobPrice) / rate)));
  const charges = sumMoney(CHARGE_KEYS.map((k) => shipment.charges?.[k] ?? 0));
  const landed = round2(fobUSD + charges);
  const salesValue = sumMoney(shipment.items.map((i) => multiply(i.qty, i.salesPrice ?? 0)));
  const grossProfit = round2(salesValue - landed);
  const paid = sumMoney((shipment.payments ?? []).map((p) => p.amount));
  return {
    fobForeign,
    fobUSD,
    charges,
    landed,
    salesValue,
    grossProfit,
    marginPct: salesValue > 0 ? round2((grossProfit / salesValue) * 100) : 0,
    totalQty: round4(shipment.items.reduce((s, i) => s + i.qty, 0)),
    paid,
    balanceDue: round2(landed - paid),
  };
}

// Charges are shared over the lines by FOB value; result is cost per ordered unit.
function landedUnitCosts(shipment) {
  const rate = shipment.currency === 'USD' ? 1 : shipment.exchangeRate || 1;
  const { fobUSD, charges } = computeTotals(shipment);
  return shipment.items.map((line) => {
    const lineFob = (line.qty * line.fobPrice) / rate;
    const share = fobUSD > 0 ? lineFob / fobUSD : 1 / shipment.items.length;
    return round4((lineFob + charges * share) / line.qty);
  });
}

const stagesOf = (shipment) => ROUTE_STAGES[shipment.route];

function latestStage(shipment) {
  const done = stagesOf(shipment).filter((s) => shipment.stages.get(s.key)?.date);
  return done.at(-1)?.key;
}

const withTotals = (shipment) => ({ ...shipment.toJSON(), totals: computeTotals(shipment) });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadShipment(id, scope, session) {
  const shipment = await repo.findShipmentById(id, session);
  if (!shipment) throw ApiError.notFound('Shipment not found');
  scope.assertAccess(shipment.branchId);
  return shipment;
}

function assertEditable(shipment) {
  if (shipment.status === 'voided') throw ApiError.unprocessable('This shipment is voided');
  if (shipment.status === 'delivered')
    throw ApiError.unprocessable('This shipment is already delivered');
}

// Looks up supplier / transporter / agent / items and fills in their names.
async function resolveParties(input) {
  const out = {};
  if (input.supplierId)
    out.supplierName = (await masterServices.suppliers.getActive(input.supplierId)).name;
  if (input.transporterId)
    out.transporterName = (await masterServices.transporters.getActive(input.transporterId)).name;
  if (input.customAgencyId)
    out.customAgencyName = (
      await masterServices.customAgencies.getActive(input.customAgencyId)
    ).name;
  if (input.items) {
    const items = await itemService.getActiveMany(input.items.map((i) => i.itemId));
    out.items = input.items.map((i) => ({
      ...i,
      itemName: items.get(i.itemId).name,
      unit: items.get(i.itemId).unit,
    }));
  }
  if (input.currency === 'USD') out.exchangeRate = 1;
  return out;
}

const PAYEE = {
  supplier: (s) => ({ kind: 'supplier', id: s.supplierId, name: s.supplierName }),
  freight: (s) =>
    s.transporterId && { kind: 'transporter', id: s.transporterId, name: s.transporterName },
  customs: (s) =>
    s.customAgencyId && { kind: 'custom_agency', id: s.customAgencyId, name: s.customAgencyName },
  clearing: (s) =>
    s.customAgencyId && { kind: 'custom_agency', id: s.customAgencyId, name: s.customAgencyName },
  other: () => undefined,
};

// ── Service ───────────────────────────────────────────────────────────────────

export const shipmentService = {
  async list(query, scope) {
    const { page, limit, skip } = paginate(query);
    const filter = {
      ...scope.filter(),
      ...searchFilter(query.search, ['shipmentNo', 'supplierName', 'transporterName', 'notes']),
      ...dateRangeFilter(query, 'orderDate'),
    };
    for (const key of ['route', 'status', 'supplierId', 'planId']) {
      if (query[key]) filter[key] = query[key];
    }
    const sort = parseSort(query.sort, ['orderDate', 'shipmentNo', 'createdAt'], {
      orderDate: -1,
      createdAt: -1,
    });
    const [rows, total] = await Promise.all([
      repo.findShipments(filter, { skip, limit, sort }),
      repo.countShipments(filter),
    ]);
    return { items: rows.map(withTotals), meta: buildMeta({ page, limit }, total) };
  },

  async getById(id, scope) {
    return withTotals(await loadShipment(id, scope));
  },

  stages: () => ROUTE_STAGES,

  async create(input, ctx) {
    const branchId = ctx.scope.writeBranch(input.branchId);
    await branchService.getActive(branchId);
    if (input.planId) {
      const plan = await repo.findPlanById(input.planId);
      if (!plan || plan.status !== 'active')
        throw ApiError.badRequest('Import plan not found or not active');
    }
    const resolved = await resolveParties(input);
    const seq = await nextSequence(`shipment:${input.route}`);
    const shipment = await repo.createShipment({
      ...input,
      ...resolved,
      branchId,
      shipmentNo: shipmentNo(ROUTE_PREFIX[input.route], seq, input.orderDate),
      createdBy: ctx.user.id,
      updatedBy: ctx.user.id,
    });
    return withTotals(shipment);
  },

  async update(id, input, ctx) {
    const shipment = await loadShipment(id, ctx.scope);
    assertEditable(shipment);
    // Only the charges that were sent change; the others keep their value.
    const charges = input.charges
      ? Object.fromEntries(
          CHARGE_KEYS.map((k) => [k, input.charges[k] ?? shipment.charges?.[k] ?? 0]),
        )
      : undefined;
    Object.assign(shipment, input, await resolveParties(input), { updatedBy: ctx.user.id });
    if (charges) shipment.charges = charges;
    await shipment.save();
    return withTotals(shipment);
  },

  // Stages are completed in order, and dates cannot go backwards.
  async setStage(id, stageKey, input, ctx) {
    const shipment = await loadShipment(id, ctx.scope);
    assertEditable(shipment);
    const stages = stagesOf(shipment);
    const index = stages.findIndex((s) => s.key === stageKey);
    if (index < 0)
      throw ApiError.badRequest(`"${stageKey}" is not a stage of a ${shipment.route} shipment`);
    if (stageKey === DELIVERED)
      throw ApiError.badRequest('Use the deliver action to complete delivery');

    const previous = stages[index - 1] && shipment.stages.get(stages[index - 1].key);
    if (index > 0 && !previous?.date) {
      throw ApiError.unprocessable(`Complete "${stages[index - 1].label}" first`);
    }
    const next = stages[index + 1] && shipment.stages.get(stages[index + 1].key);
    if (input.date < (previous?.date ?? shipment.orderDate)) {
      throw ApiError.unprocessable('This date is before the previous stage (or the order date)');
    }
    if (next?.date && input.date > next.date) {
      throw ApiError.unprocessable('This date is after the next stage');
    }

    shipment.stages.set(stageKey, { ...input, updatedBy: ctx.user.id, updatedAt: new Date() });
    shipment.currentStage = latestStage(shipment);
    shipment.status = 'in_transit';
    shipment.updatedBy = ctx.user.id;
    await shipment.save();
    return withTotals(shipment);
  },

  // Undo the latest completed stage (frontend: "Revoke").
  async revokeStage(id, stageKey, ctx) {
    const shipment = await loadShipment(id, ctx.scope);
    assertEditable(shipment);
    if (shipment.currentStage !== stageKey) {
      throw ApiError.unprocessable('Only the latest completed stage can be undone');
    }
    shipment.stages.delete(stageKey);
    shipment.currentStage = latestStage(shipment);
    if (!shipment.currentStage) shipment.status = 'draft';
    shipment.updatedBy = ctx.user.id;
    await shipment.save();
    return withTotals(shipment);
  },

  /**
   * Final delivery: received goods enter the godown at landed cost, and
   *   Dr Stock / Cr Import Clearing  (cleared later by supplier/freight payments)
   * Short or excess quantities are recorded as discrepancies.
   */
  deliver(id, input, ctx) {
    return inTransaction(null, async (session) => {
      const shipment = await loadShipment(id, ctx.scope, session);
      assertEditable(shipment);
      const stages = stagesOf(shipment);
      const beforeDelivery = stages[stages.length - 2];
      if (!shipment.stages.get(beforeDelivery.key)?.date) {
        throw ApiError.unprocessable(`Complete "${beforeDelivery.label}" before delivery`);
      }
      await settingService.assertPeriodOpen(input.date, session);
      const branchId = String(shipment.branchId);
      const branch = await branchService.getActive(branchId, session);
      const godown = await inventoryService.resolveGodown(branchId, input.godownId, session);

      const received = new Map((input.receivedQtys ?? []).map((r) => [r.lineId, r.qty]));
      const unitCosts = landedUnitCosts(shipment);
      const voucherId = new mongoose.Types.ObjectId();
      const voucherNo = await voucherService.reserveNumber('journal', branch, input.date, session);

      const entries = [];
      const discrepancies = [];
      shipment.items.forEach((line, index) => {
        const qty = received.get(String(line._id)) ?? line.qty;
        line.receivedQty = qty;
        line.unitLandedCost = unitCosts[index];
        if (qty !== line.qty) {
          discrepancies.push({
            lineId: line._id,
            itemName: line.itemName,
            orderedQty: line.qty,
            receivedQty: qty,
            diff: round4(qty - line.qty),
          });
        }
        if (qty > 0) {
          entries.push({
            type: 'import_receipt',
            itemId: line.itemId,
            qty,
            unitCost: unitCosts[index],
            godownId: godown._id,
            branchId,
            date: input.date,
            ref: { type: 'shipment', id: shipment._id, no: shipment.shipmentNo },
          });
        }
      });
      if (!entries.length) throw ApiError.unprocessable('Nothing was received');

      const movements = await inventoryService.applyMovements(entries, {
        session,
        userId: ctx.user.id,
      });
      const value = sumMoney(movements.map((m) => m.value));
      const stock = await accountService.getSystem(K.STOCK, { session });
      const clearing = await accountService.getSystem(K.IMPORT_CLEARING, { session });
      await voucherService.postVoucher(
        {
          vType: 'journal',
          date: input.date,
          branchId,
          narration: `Goods received — ${shipment.shipmentNo} from ${shipment.supplierName}`,
          lines: [
            { accountId: stock._id, debit: value },
            { accountId: clearing._id, credit: value },
          ],
        },
        ctx,
        {
          session,
          source: 'imports',
          voucherId,
          voucherNo,
          godownId: godown._id,
          sourceRef: { refType: 'shipment', refId: shipment._id, refNo: shipment.shipmentNo },
        },
      );

      const short = discrepancies.some((d) => d.diff < 0);
      const excess = discrepancies.some((d) => d.diff > 0);
      shipment.delivery = {
        date: input.date,
        godownId: godown._id,
        receivedBy: input.receivedBy,
        notes: input.notes,
        discrepancies: discrepancies.length ? discrepancies : undefined,
        noteType:
          short && excess
            ? 'Short & Excess'
            : short
              ? 'Short Delivery'
              : excess
                ? 'Excess Delivery'
                : undefined,
        voucherId,
      };
      shipment.stages.set(DELIVERED, {
        date: input.date,
        notes: input.notes,
        updatedBy: ctx.user.id,
        updatedAt: new Date(),
      });
      shipment.currentStage = DELIVERED;
      shipment.status = 'delivered';
      shipment.updatedBy = ctx.user.id;
      await shipment.save({ session });
      return withTotals(shipment);
    });
  },

  // Supplier / freight / customs payment: Dr Import Clearing / Cr Cash or Bank.
  addPayment(id, input, ctx) {
    return inTransaction(null, async (session) => {
      const shipment = await loadShipment(id, ctx.scope, session);
      if (shipment.status === 'voided') throw ApiError.unprocessable('This shipment is voided');
      const account = await accountService.getById(input.accountId, session);
      if (!account.isActive || !accountService.isCashOrBank(account)) {
        throw ApiError.badRequest('Pay from an active cash or bank account');
      }
      const clearing = await accountService.getSystem(K.IMPORT_CLEARING, { session });
      const { voucher } = await voucherService.postVoucher(
        {
          vType: 'payment',
          date: input.date,
          branchId: String(shipment.branchId),
          party: PAYEE[input.kind](shipment) || undefined,
          narration: input.notes ?? `${input.kind} payment — ${shipment.shipmentNo}`,
          reference: input.reference,
          lines: [
            { accountId: clearing._id, debit: input.amount },
            { accountId: account._id, credit: input.amount },
          ],
        },
        ctx,
        {
          session,
          source: 'imports',
          sourceRef: { refType: 'shipment', refId: shipment._id, refNo: shipment.shipmentNo },
        },
      );
      shipment.payments.push({
        ...input,
        accountName: account.name,
        voucherId: voucher._id,
        voucherNo: voucher.voucherNo,
      });
      shipment.updatedBy = ctx.user.id;
      await shipment.save({ session });
      return withTotals(shipment);
    });
  },

  async void(id, reason, ctx) {
    const shipment = await loadShipment(id, ctx.scope);
    assertEditable(shipment);
    if (shipment.payments.length) {
      throw ApiError.unprocessable('This shipment has payments. It cannot be voided.');
    }
    Object.assign(shipment, {
      status: 'voided',
      voidReason: reason,
      voidedAt: new Date(),
      voidedBy: ctx.user.id,
      updatedBy: ctx.user.id,
    });
    await shipment.save();
    return withTotals(shipment);
  },

  // Pipeline dashboard: in-transit value by stage, transporter, supplier and product line.
  async pipelineSummary(scope) {
    const shipments = await repo.findAllShipments({ ...scope.filter(), status: 'in_transit' });
    const groups = { byStage: {}, byTransporter: {}, bySupplier: {}, byProductType: {} };
    const kpis = { count: 0, fobUSD: 0, charges: 0, landed: 0 };

    const add = (bucket, key, totals) => {
      const row = (bucket[key] ??= { key, count: 0, fobUSD: 0, charges: 0, landed: 0 });
      row.count += 1;
      row.fobUSD = round2(row.fobUSD + totals.fobUSD);
      row.charges = round2(row.charges + totals.charges);
      row.landed = round2(row.landed + totals.landed);
    };

    for (const s of shipments) {
      const totals = computeTotals(s);
      const stage = ROUTE_STAGES[s.route].find((st) => st.key === s.currentStage);
      add(groups.byStage, `${s.route} · ${stage?.label ?? s.currentStage}`, totals);
      add(groups.byTransporter, s.transporterName || 'Not assigned', totals);
      add(groups.bySupplier, s.supplierName || 'Unknown', totals);
      add(groups.byProductType, s.productType || 'uncl', totals);
      kpis.count += 1;
      kpis.fobUSD = round2(kpis.fobUSD + totals.fobUSD);
      kpis.charges = round2(kpis.charges + totals.charges);
      kpis.landed = round2(kpis.landed + totals.landed);
    }
    const sorted = (bucket) => Object.values(bucket).sort((a, b) => b.landed - a.landed);
    return {
      kpis,
      byStage: sorted(groups.byStage),
      byTransporter: sorted(groups.byTransporter),
      bySupplier: sorted(groups.bySupplier),
      byProductType: sorted(groups.byProductType),
    };
  },

  findForPlan: (planId) => repo.findAllShipments({ planId, status: { $ne: 'voided' } }),
};
