import { ApiError } from '#shared/utils/ApiError.js';
import { fromCents, round2, round4, sumMoney, toCents } from '#shared/utils/money.js';
import {
  buildMeta,
  dateRangeFilter,
  paginate,
  parseSort,
  searchFilter,
} from '#shared/utils/pagination.js';
import { inTransaction } from '#shared/db/transaction.js';
import { nextSequence } from '#shared/db/counter.js';
import { branchDocNo } from '#shared/utils/docNumber.js';
import { periodOf } from '#shared/utils/dates.js';
import {
  BASE_CURRENCY,
  SALE_TYPES,
  VOUCHER_PREFIX,
  VOUCHER_STATUS,
} from '#shared/constants/enums.js';
import { accountService, SYSTEM_KEYS } from '#modules/accounts/index.js';
import { branchService } from '#modules/branches/index.js';
import { settingService } from '#modules/settings/index.js';
import { masterServices } from '#modules/masters/index.js';
import { approvalService } from '#modules/approvals/index.js';
import { voucherRepository } from './voucher.repository.js';

const PARTY_SERVICES = {
  client: masterServices.clients,
  supplier: masterServices.suppliers,
  transporter: masterServices.transporters,
  custom_agency: masterServices.customAgencies,
};

// Which invoices a receipt / payment may settle.
const SETTLES = {
  receipt: { partyKind: 'client', vTypes: SALE_TYPES },
  payment: { partyKind: 'supplier', vTypes: ['purchase'] },
};

const centsOf = (lines, side) => lines.reduce((sum, l) => sum + toCents(l[side]), 0);

function assertLinesValid(lines) {
  for (const line of lines) {
    if (line.debit > 0 === line.credit > 0) {
      throw ApiError.badRequest('Each line needs either a debit or a credit amount (not both)');
    }
  }
  const debit = centsOf(lines, 'debit');
  const credit = centsOf(lines, 'credit');
  if (debit !== credit) {
    throw ApiError.badRequest(
      `The voucher does not balance: debits ${fromCents(debit)} ≠ credits ${fromCents(credit)}`,
    );
  }
  if (debit === 0) throw ApiError.badRequest('The voucher total cannot be zero');
}

// Books are kept in USD. A CDF voucher is converted line by line at `rate`
// (the original amount is kept on each line). Rounding each line can leave
// a cent of difference; it is added to the largest line on the smaller side.
function convertToBase(lines, currency, rate) {
  const converted = lines.map((l) => ({
    ...l,
    debit: round2(l.debit / rate),
    credit: round2(l.credit / rate),
    fcAmount: l.debit || l.credit,
    fcCurrency: currency,
    fxRate: rate,
  }));
  const diff = centsOf(converted, 'debit') - centsOf(converted, 'credit');
  if (diff !== 0) {
    const side = diff > 0 ? 'credit' : 'debit';
    const target = converted.filter((l) => l[side] > 0).sort((a, b) => b[side] - a[side])[0];
    target[side] = fromCents(toCents(target[side]) + Math.abs(diff));
  }
  return converted;
}

function needsApproval(user, total) {
  const { isSuperAdmin, canApprove, approvalLimit } = user.role;
  if (isSuperAdmin || canApprove || approvalLimit === null || approvalLimit === undefined)
    return false;
  return total > approvalLimit;
}

// System callers pass a ready party ({ kind, id, name }). API input only has kind + id.
async function resolveParty(party, session) {
  if (!party) return undefined;
  if (party.name) return party;
  const service = PARTY_SERVICES[party.kind];
  if (!service) throw ApiError.badRequest(`Unknown party type "${party.kind}"`);
  const doc = await service.getActive(party.id, session);
  return { kind: party.kind, id: doc._id, name: doc.name };
}

async function checkCreditLimit(party, amount, confirmed, session) {
  const client = await masterServices.clients.getActive(party.id, session);
  if (!(client.creditLimit > 0)) return;
  const outstanding = await voucherRepository.outstandingForParty(party.id, SALE_TYPES, session);
  const newTotal = round2(outstanding + amount);
  if (newTotal > client.creditLimit && !confirmed) {
    throw ApiError.unprocessable(`${client.name} would go over their credit limit`, {
      code: 'CREDIT_LIMIT_EXCEEDED',
      outstanding,
      invoice: amount,
      newTotal,
      limit: client.creditLimit,
      hint: 'Send confirmCreditLimit: true to post anyway',
    });
  }
}

// Allocates a receipt/payment to invoices and increases their settled amount.
async function settleBills(billRefs, party, vType, total, session) {
  const rule = SETTLES[vType];
  if (!party || party.kind !== rule.partyKind) {
    throw ApiError.badRequest(
      `A ${vType} that settles invoices needs a ${rule.partyKind} as party`,
    );
  }
  if (sumMoney(billRefs.map((r) => r.amount)) > total) {
    throw ApiError.badRequest('Allocated amounts are more than the voucher total');
  }
  const refs = [];
  for (const ref of billRefs) {
    const invoice = await voucherRepository.findById(ref.voucherId, session);
    if (
      !invoice ||
      invoice.status !== VOUCHER_STATUS.POSTED ||
      !rule.vTypes.includes(invoice.vType) ||
      String(invoice.party?.id) !== String(party.id)
    ) {
      throw ApiError.badRequest(`Invoice ${ref.voucherId} is not an open invoice of ${party.name}`);
    }
    const open = round2(invoice.invoiceAmount - invoice.settledAmount);
    if (toCents(ref.amount) > toCents(open)) {
      throw ApiError.badRequest(`Invoice ${invoice.voucherNo} only has ${open} left to settle`);
    }
    await voucherRepository.incSettled(invoice._id, ref.amount, session);
    refs.push({ voucherId: invoice._id, voucherNo: invoice.voucherNo, amount: ref.amount });
  }
  return refs;
}

function invoiceAmountOf(vType, lines, accounts) {
  const rule = {
    sales: [SYSTEM_KEYS.RECEIVABLES, 'debit'],
    purchase: [SYSTEM_KEYS.PAYABLES, 'credit'],
  }[vType];
  if (!rule) return 0;
  const [key, side] = rule;
  return sumMoney(
    lines.filter((l) => accounts.get(String(l.accountId)).systemKey === key).map((l) => l[side]),
  );
}

export const voucherService = {
  async reserveNumber(vType, branch, date, session) {
    const seq = await nextSequence(`voucher:${vType}:${branch._id}`, session);
    return branchDocNo(VOUCHER_PREFIX[vType], seq, branch.code, date);
  },

  /**
   * Posts a voucher. The single place where every accounting rule is checked.
   * `input` = { vType, date, branchId, party, narration, reference, currency, fxRate,
   *             dueDate, lines: [{ accountId, debit, credit, narration, fcAmount... }],
   *             billRefs, confirmCreditLimit }
   * `ctx` = { user, scope }. Options are for other modules (sales, imports...).
   * Returns { status: 'posted', voucher } or { status: 'pending_approval', approval }.
   */
  postVoucher(input, ctx, options = {}) {
    const {
      session,
      source = 'manual',
      skipApprovalLimit = false,
      amountsInBaseCurrency = false,
      voucherId,
      voucherNo,
      items,
      invoiceAmount,
      sourceRef,
      returnOf,
      godownId,
      approval,
      createdBy,
    } = options;

    return inTransaction(session, async (s) => {
      const branchId = ctx.scope.writeBranch(input.branchId);
      const branch = await branchService.getActive(branchId, s);
      await settingService.assertPeriodOpen(input.date, s);

      const accounts = await accountService.getForPosting(
        input.lines.map((l) => l.accountId),
        s,
      );
      for (const account of accounts.values()) {
        if (account.branchId && String(account.branchId) !== branchId) {
          throw ApiError.badRequest(`Account "${account.name}" belongs to another branch`);
        }
      }

      let lines = input.lines.map((l) => ({
        accountId: l.accountId,
        accountName: accounts.get(String(l.accountId)).name,
        debit: round2(l.debit ?? 0),
        credit: round2(l.credit ?? 0),
        narration: l.narration,
        costCentreId: l.costCentreId,
        fcAmount: l.fcAmount,
        fcCurrency: l.fcCurrency,
        fxRate: l.fxRate,
      }));
      assertLinesValid(lines);

      const currency = input.currency ?? BASE_CURRENCY;
      let fxRate = input.fxRate;
      if (currency !== BASE_CURRENCY && !amountsInBaseCurrency) {
        fxRate ??= (await settingService.getFx(s)).cdfAccountingRate;
        lines = convertToBase(lines, currency, fxRate);
        assertLinesValid(lines);
      }
      const total = sumMoney(lines.map((l) => l.debit));

      const party = await resolveParty(input.party, s);
      const arAp = [SYSTEM_KEYS.RECEIVABLES, SYSTEM_KEYS.PAYABLES];
      if (!party && lines.some((l) => arAp.includes(accounts.get(String(l.accountId)).systemKey))) {
        throw ApiError.badRequest(
          'Pick the customer or supplier for Accounts Receivable / Payable lines',
        );
      }

      const invoiced = invoiceAmount ?? invoiceAmountOf(input.vType, lines, accounts);
      if (party?.kind === 'client' && invoiced > 0 && SALE_TYPES.includes(input.vType)) {
        await checkCreditLimit(party, invoiced, input.confirmCreditLimit, s);
      }

      // Big manual vouchers wait for an approver; nothing is posted yet.
      if (source === 'manual' && !skipApprovalLimit && needsApproval(ctx.user, total)) {
        const request = await approvalService.createRequest(
          {
            type: 'voucher',
            branchId,
            title: `${input.vType} voucher of ${total} USD`,
            amount: total,
            payload: { input: { ...input, branchId }, requestedBy: ctx.user.id },
          },
          ctx.user,
          s,
        );
        return { status: 'pending_approval', approval: request };
      }

      const billRefs = input.billRefs?.length
        ? await settleBills(input.billRefs, party, input.vType, total, s)
        : undefined;

      const voucher = await voucherRepository.create(
        {
          _id: voucherId,
          voucherNo:
            voucherNo ?? (await voucherService.reserveNumber(input.vType, branch, input.date, s)),
          vType: input.vType,
          date: input.date,
          period: periodOf(input.date),
          branchId,
          godownId,
          party,
          narration: input.narration,
          reference: input.reference,
          currency,
          fxRate,
          lines,
          totalDebit: total,
          totalCredit: total,
          items,
          invoiceAmount: invoiced,
          dueDate: input.dueDate,
          billRefs,
          source,
          sourceRef,
          returnOf,
          approvalId: approval?.id,
          approvedBy: approval?.approvedBy,
          createdBy: createdBy ?? ctx.user.id,
          updatedBy: ctx.user.id,
        },
        s,
      );
      return { status: 'posted', voucher };
    });
  },

  // Only manual vouchers in an open period can be voided. Documents made by other
  // modules (sales, imports...) are reversed from there (e.g. a sales return).
  voidVoucher(id, reason, ctx) {
    return inTransaction(null, async (s) => {
      const voucher = await voucherRepository.findById(id, s);
      if (!voucher) throw ApiError.notFound('Voucher not found');
      ctx.scope.assertAccess(voucher.branchId);
      if (voucher.status === VOUCHER_STATUS.VOIDED)
        throw ApiError.conflict('Voucher is already voided');
      if (voucher.source !== 'manual') {
        throw ApiError.unprocessable(
          `This voucher was created by ${voucher.source}. Reverse it from there instead.`,
        );
      }
      await settingService.assertPeriodOpen(voucher.date, s);
      if (voucher.settledAmount > 0) {
        throw ApiError.unprocessable(
          'Receipts or payments are allocated to this invoice. Void those first.',
        );
      }
      for (const ref of voucher.billRefs ?? []) {
        await voucherRepository.incSettled(ref.voucherId, -ref.amount, s);
      }
      voucher.status = VOUCHER_STATUS.VOIDED;
      voucher.voidReason = reason;
      voucher.voidedAt = new Date();
      voucher.voidedBy = ctx.user.id;
      voucher.updatedBy = ctx.user.id;
      await voucher.save({ session: s });
      return voucher;
    });
  },

  async list(query, scope, { vTypes } = {}) {
    const { page, limit, skip } = paginate(query);
    const filter = {
      ...scope.filter(),
      ...searchFilter(query.search, ['voucherNo', 'narration', 'reference', 'party.name']),
      ...dateRangeFilter(query),
    };
    if (query.vType) filter.vType = query.vType;
    else if (vTypes) filter.vType = { $in: vTypes };
    if (query.status) filter.status = query.status;
    if (query.source) filter.source = query.source;
    if (query.partyId) filter['party.id'] = query.partyId;
    if (query.accountId) filter['lines.accountId'] = query.accountId;
    const sort = parseSort(query.sort, ['date', 'voucherNo', 'totalDebit', 'createdAt'], {
      date: -1,
      createdAt: -1,
    });
    const [items, total] = await Promise.all([
      voucherRepository.find(filter, { skip, limit, sort }),
      voucherRepository.count(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },

  async getById(id, scope, session) {
    const voucher = await voucherRepository.findById(id, session);
    if (!voucher) throw ApiError.notFound('Voucher not found');
    scope?.assertAccess(voucher.branchId);
    return voucher;
  },

  // Invoices that still have money owed, with their open balance.
  async outstanding({ kind, partyId }, scope) {
    const filter = {
      ...scope.filter(),
      vType: { $in: kind === 'payable' ? ['purchase'] : SALE_TYPES },
    };
    if (partyId) filter['party.id'] = partyId;
    const invoices = await voucherRepository.findOpenInvoices(filter);
    return invoices.map((v) => ({
      id: String(v._id),
      voucherNo: v.voucherNo,
      vType: v.vType,
      date: v.date,
      dueDate: v.dueDate,
      branchId: v.branchId,
      party: v.party,
      invoiceAmount: v.invoiceAmount,
      settledAmount: v.settledAmount,
      balance: round2(v.invoiceAmount - v.settledAmount),
    }));
  },

  // ── Used by other modules ──────────────────────────────────────────────────

  // A credit/debit note reduces what is still owed on the original invoice.
  async reduceOutstanding(invoiceId, amount, session) {
    const invoice = await voucherRepository.findById(invoiceId, session);
    const open = round2(invoice.invoiceAmount - invoice.settledAmount);
    const applied = Math.min(open, amount);
    if (applied > 0) await voucherRepository.incSettled(invoiceId, applied, session);
    return applied;
  },

  // A plain copy of a voucher's party, to put on a related voucher (e.g. a return).
  partyOf: (voucher) =>
    voucher.party?.id
      ? { kind: voucher.party.kind, id: voucher.party.id, name: voucher.party.name }
      : undefined,

  // For returns: checks each requested qty is still returnable on `voucher` and
  // gives back the original average price and cost per unit.
  checkReturnable(voucher, requested) {
    const totals = new Map();
    for (const line of voucher.items ?? []) {
      const key = String(line.itemId);
      const t = totals.get(key) ?? {
        name: line.itemName,
        unit: line.unit,
        qty: 0,
        returned: 0,
        amount: 0,
        cost: 0,
      };
      t.qty += line.qty;
      t.returned += line.returnedQty ?? 0;
      t.amount += line.amount ?? 0;
      t.cost += line.costAmount ?? 0;
      totals.set(key, t);
    }
    return requested.map(({ itemId, qty }) => {
      const t = totals.get(String(itemId));
      if (!t) throw ApiError.badRequest(`Item ${itemId} is not on ${voucher.voucherNo}`);
      const left = round4(t.qty - t.returned);
      if (qty > left) {
        throw ApiError.unprocessable(
          `Only ${left} of ${t.name} can still be returned on ${voucher.voucherNo}`,
        );
      }
      return {
        itemId,
        itemName: t.name,
        unit: t.unit,
        qty,
        unitPrice: round2(t.amount / t.qty),
        unitCost: round4(t.cost / t.qty),
      };
    });
  },

  async recordItemReturns(voucherId, returns, session) {
    for (const { itemId, qty } of returns) {
      await voucherRepository.incReturnedQty(voucherId, itemId, qty, session);
    }
  },

  accountTotals: (match) => voucherRepository.accountTotals(match),
  ledgerLines: (accountId, match, limit) => voucherRepository.ledgerLines(accountId, match, limit),
  aggregate: (pipeline) => voucherRepository.aggregate(pipeline),
};
