import { round2, sumMoney, toCents } from '#shared/utils/money.js';
import { dateRangeFilter } from '#shared/utils/pagination.js';
import { daysBetween, today } from '#shared/utils/dates.js';
import { accountService } from '#modules/accounts/index.js';
import { voucherService } from '#modules/vouchers/index.js';
import { inventoryService } from '#modules/inventory/index.js';
import { approvalService } from '#modules/approvals/index.js';
import { shipmentService } from '#modules/imports/index.js';

// Debit-positive accounts (assets, expenses) vs credit-positive (liabilities, equity, income).
const DEBIT_NATURES = ['asset', 'expense'];
const signed = (nature, net) => (DEBIT_NATURES.includes(nature) ? net : -net);
const split = (net) => ({ debit: net > 0 ? round2(net) : 0, credit: net < 0 ? round2(-net) : 0 });

// Opening balances on accounts are company-wide, so they only appear in the
// full Group view (not when looking at one branch).
const showsOpening = (scope) => scope.isGroupView && !scope.allowedBranchIds;

const openingNet = (account) =>
  account.openingBalance?.side === 'Cr'
    ? -(account.openingBalance?.amount ?? 0)
    : (account.openingBalance?.amount ?? 0);

const byAccount = (rows) => new Map(rows.map((r) => [String(r._id), round2(r.debit - r.credit)]));

// Net (debit − credit) per account: before `from`, and within from..to.
async function accountNets(scope, { from, to }) {
  const branch = scope.filter();
  const [before, during] = await Promise.all([
    from ? voucherService.accountTotals({ ...branch, date: { $lt: from } }) : [],
    voucherService.accountTotals({ ...branch, ...dateRangeFilter({ from, to }) }),
  ]);
  return { before: byAccount(before), during: byAccount(during) };
}

function section(rows, groups) {
  const accounts = rows.filter((r) => groups.includes(r.primaryGroup) && toCents(r.amount) !== 0);
  return { accounts, total: sumMoney(accounts.map((a) => a.amount)) };
}

const SALE_VTYPES = ['cashsale', 'creditsale'];

export const reportService = {
  async trialBalance({ from, to }, scope) {
    const accounts = await accountService.listAll();
    const { before, during } = await accountNets(scope, { from, to });
    const withOpening = showsOpening(scope);

    const rows = accounts
      .map((a) => {
        const id = String(a._id);
        const opening = round2((withOpening ? openingNet(a) : 0) + (before.get(id) ?? 0));
        const movement = during.get(id) ?? 0;
        return {
          accountId: id,
          name: a.name,
          primaryGroup: a.primaryGroup,
          nature: a.nature,
          opening: split(opening),
          period: split(movement),
          closing: split(round2(opening + movement)),
        };
      })
      .filter((r) => [r.opening, r.period, r.closing].some((x) => x.debit || x.credit));

    const totals = {
      debit: sumMoney(rows.map((r) => r.closing.debit)),
      credit: sumMoney(rows.map((r) => r.closing.credit)),
    };
    return { from, to, rows, totals, isBalanced: toCents(totals.debit) === toCents(totals.credit) };
  },

  // Tally layout: gross profit first, then net profit.
  async profitAndLoss({ from, to }, scope) {
    const accounts = await accountService.listAll({ nature: { $in: ['income', 'expense'] } });
    const { during } = await accountNets(scope, { from, to });
    const rows = accounts.map((a) => ({
      accountId: String(a._id),
      name: a.name,
      primaryGroup: a.primaryGroup,
      amount: round2(signed(a.nature, during.get(String(a._id)) ?? 0)),
    }));

    const sales = section(rows, [10]);
    const directIncome = section(rows, [11]);
    const purchases = section(rows, [13]);
    const directExpenses = section(rows, [14]);
    const indirectIncome = section(rows, [12]);
    const indirectExpenses = section(rows, [15]);
    const grossProfit = round2(
      sales.total + directIncome.total - purchases.total - directExpenses.total,
    );
    const netProfit = round2(grossProfit + indirectIncome.total - indirectExpenses.total);
    return {
      from,
      to,
      sales,
      directIncome,
      purchases,
      directExpenses,
      grossProfit,
      grossMarginPct: sales.total > 0 ? round2((grossProfit / sales.total) * 100) : 0,
      indirectIncome,
      indirectExpenses,
      netProfit,
    };
  },

  async balanceSheet({ asOf = today() }, scope) {
    const accounts = await accountService.listAll();
    const { during } = await accountNets(scope, { to: asOf });
    const withOpening = showsOpening(scope);
    const rows = accounts.map((a) => ({
      accountId: String(a._id),
      name: a.name,
      primaryGroup: a.primaryGroup,
      nature: a.nature,
      amount: round2(
        signed(a.nature, (withOpening ? openingNet(a) : 0) + (during.get(String(a._id)) ?? 0)),
      ),
    }));
    const ofNature = (nature) => {
      const list = rows.filter((r) => r.nature === nature && toCents(r.amount) !== 0);
      return { accounts: list, total: sumMoney(list.map((r) => r.amount)) };
    };
    const assets = ofNature('asset');
    const liabilities = ofNature('liability');
    const equity = ofNature('equity');
    // Profit not yet closed into equity = all income − all expenses to date.
    const profitToDate = round2(ofNature('income').total - ofNature('expense').total);
    const totalLiabilitiesAndEquity = round2(liabilities.total + equity.total + profitToDate);
    return {
      asOf,
      assets,
      liabilities,
      equity,
      profitToDate,
      totalAssets: assets.total,
      totalLiabilitiesAndEquity,
      isBalanced: toCents(assets.total) === toCents(totalLiabilitiesAndEquity),
    };
  },

  async ledger({ accountId, from, to, limit }, scope) {
    const account = await accountService.getById(accountId);
    const branch = scope.filter();
    const [beforeRows, lines] = await Promise.all([
      from ? voucherService.accountTotals({ ...branch, date: { $lt: from } }) : [],
      voucherService.ledgerLines(accountId, { ...branch, ...dateRangeFilter({ from, to }) }, limit),
    ]);
    const before = byAccount(beforeRows).get(String(account._id)) ?? 0;
    const opening = round2((showsOpening(scope) ? openingNet(account) : 0) + before);

    let running = opening;
    const entries = lines.map((l) => {
      running = round2(running + l.debit - l.credit);
      return { ...l, balance: split(running) };
    });
    return {
      account: { id: String(account._id), name: account.name, nature: account.nature },
      from,
      to,
      opening: split(opening),
      entries,
      closing: split(running),
      truncated: lines.length === limit,
    };
  },

  async cashPosition(scope) {
    const accounts = (await accountService.listAll({ isActive: true })).filter(
      (a) => accountService.isCashOrBank(a) && (!a.branchId || scope.canAccess(a.branchId)),
    );
    const { during } = await accountNets(scope, {});
    const withOpening = showsOpening(scope);
    const rows = accounts.map((a) => ({
      accountId: String(a._id),
      name: a.name,
      branchId: a.branchId,
      currency: a.currency,
      balance: round2((withOpening ? openingNet(a) : 0) + (during.get(String(a._id)) ?? 0)),
    }));
    return { accounts: rows, total: sumMoney(rows.map((r) => r.balance)) };
  },

  // Open invoices per customer/supplier, split by age (days since invoice date).
  async aging({ kind, asOf = today() }, scope) {
    const invoices = await voucherService.outstanding({ kind }, scope);
    const buckets = ['0-30', '31-60', '61-90', '90+'];
    const bucketOf = (days) =>
      days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
    const parties = new Map();
    for (const inv of invoices) {
      const key = String(inv.party?.id ?? 'none');
      const row = parties.get(key) ?? {
        partyId: inv.party?.id,
        name: inv.party?.name ?? 'Walk-in',
        total: 0,
        ...Object.fromEntries(buckets.map((b) => [b, 0])),
      };
      const bucket = bucketOf(Math.max(0, daysBetween(inv.date, asOf)));
      row[bucket] = round2(row[bucket] + inv.balance);
      row.total = round2(row.total + inv.balance);
      parties.set(key, row);
    }
    const rows = [...parties.values()].sort((a, b) => b.total - a.total);
    return {
      kind,
      asOf,
      rows,
      totals: Object.fromEntries(
        ['total', ...buckets].map((b) => [b, sumMoney(rows.map((r) => r[b]))]),
      ),
    };
  },

  // Revenue, cost and gross profit from sales (returns subtracted).
  async salesSummary({ from, to, groupBy }, scope) {
    const keys = {
      day: '$date',
      branch: '$branchId',
      item: '$items.itemId',
      productType: '$item.productType',
    };
    const pipeline = [
      {
        $match: {
          status: 'posted',
          ...scope.filter(),
          ...dateRangeFilter({ from, to }),
          $or: [{ vType: { $in: SALE_VTYPES } }, { vType: 'creditnote', source: 'sales' }],
        },
      },
      { $unwind: '$items' },
      { $addFields: { sign: { $cond: [{ $eq: ['$vType', 'creditnote'] }, -1, 1] } } },
    ];
    if (groupBy === 'productType') {
      pipeline.push(
        { $lookup: { from: 'items', localField: 'items.itemId', foreignField: '_id', as: 'item' } },
        { $unwind: '$item' },
      );
    }
    pipeline.push(
      {
        $group: {
          _id: keys[groupBy],
          label: { $first: groupBy === 'item' ? '$items.itemName' : keys[groupBy] },
          qty: { $sum: { $multiply: ['$items.qty', '$sign'] } },
          revenue: { $sum: { $multiply: ['$items.amount', '$sign'] } },
          cost: { $sum: { $multiply: ['$items.costAmount', '$sign'] } },
        },
      },
      { $sort: { _id: 1 } },
    );
    const raw = await voucherService.aggregate(pipeline);
    const rows = raw.map((r) => {
      const revenue = round2(r.revenue);
      const cost = round2(r.cost);
      const grossProfit = round2(revenue - cost);
      return {
        key: r._id,
        label: r.label,
        qty: r.qty,
        revenue,
        cost,
        grossProfit,
        marginPct: revenue > 0 ? round2((grossProfit / revenue) * 100) : 0,
      };
    });
    const revenue = sumMoney(rows.map((r) => r.revenue));
    const cost = sumMoney(rows.map((r) => r.cost));
    return {
      from,
      to,
      groupBy,
      rows,
      totals: { revenue, cost, grossProfit: round2(revenue - cost) },
    };
  },

  stockValuation: (scope) => inventoryService.valuation(scope),

  async dashboard(scope) {
    const day = today();
    const monthStart = `${day.slice(0, 7)}-01`;
    const [
      todaySales,
      monthSales,
      cash,
      receivables,
      payables,
      pendingApprovals,
      pipeline,
      stock,
      lowStock,
    ] = await Promise.all([
      reportService.salesSummary({ from: day, to: day, groupBy: 'day' }, scope),
      reportService.salesSummary({ from: monthStart, to: day, groupBy: 'day' }, scope),
      reportService.cashPosition(scope),
      reportService.aging({ kind: 'receivable' }, scope),
      reportService.aging({ kind: 'payable' }, scope),
      approvalService.countPending(scope),
      shipmentService.pipelineSummary(scope),
      inventoryService.valuation(scope),
      inventoryService.listBalances({ lowStock: true, page: 1, limit: 1 }, scope),
    ]);
    return {
      date: day,
      sales: {
        today: todaySales.totals.revenue,
        monthToDate: monthSales.totals.revenue,
        monthGrossProfit: monthSales.totals.grossProfit,
      },
      cashPosition: cash.total,
      receivables: receivables.totals.total,
      payables: payables.totals.total,
      pendingApprovals,
      shipmentsInTransit: pipeline.kpis,
      stockValue: stock.totalValue,
      lowStockItems: lowStock.meta.total,
    };
  },
};
