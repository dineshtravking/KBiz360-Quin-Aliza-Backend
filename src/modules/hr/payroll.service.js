import { ApiError } from '#shared/utils/ApiError.js';
import { round2, sumMoney } from '#shared/utils/money.js';
import { buildMeta, paginate, parseSort } from '#shared/utils/pagination.js';
import { inTransaction } from '#shared/db/transaction.js';
import { nextSequence } from '#shared/db/counter.js';
import { branchDocNo } from '#shared/utils/docNumber.js';
import { accountService, SYSTEM_KEYS as K } from '#modules/accounts/index.js';
import { branchService } from '#modules/branches/index.js';
import { voucherService } from '#modules/vouchers/index.js';
import { advanceRepository, payrollRepository as repo } from './hr.repository.js';
import { staffService } from './staff.service.js';

async function cashOrBank(id, session) {
  const account = await accountService.getById(id, session);
  if (!account.isActive || !accountService.isCashOrBank(account)) {
    throw ApiError.badRequest('Pay from an active cash or bank account');
  }
  return account;
}

// Money still owed on open advances, per staff member.
async function openAdvances(staffIds, session) {
  const advances = await advanceRepository.findAll(
    { staffId: { $in: staffIds }, status: 'open' },
    session,
  );
  const byStaff = new Map();
  for (const a of advances.sort((x, y) => x.date.localeCompare(y.date))) {
    const key = String(a.staffId);
    byStaff.set(key, [...(byStaff.get(key) ?? []), a]);
  }
  return byStaff;
}

const remainingOf = (list = []) => sumMoney(list.map((a) => a.amount - a.recoveredAmount));

function computeLine(line) {
  const gross = round2(line.basic + line.allowances);
  const net = round2(gross - line.otherDeductions - line.advanceRecovery);
  if (net < 0)
    throw ApiError.unprocessable(`Deductions for ${line.staffName} are more than their pay`);
  return { ...line, gross, net };
}

function totalsOf(lines) {
  return {
    gross: sumMoney(lines.map((l) => l.gross)),
    otherDeductions: sumMoney(lines.map((l) => l.otherDeductions)),
    advanceRecovery: sumMoney(lines.map((l) => l.advanceRecovery)),
    net: sumMoney(lines.map((l) => l.net)),
  };
}

async function loadRun(id, scope, session) {
  const run = await repo.findById(id, session);
  if (!run) throw ApiError.notFound('Payroll run not found');
  scope.assertAccess(run.branchId);
  return run;
}

export const payrollService = {
  // ── Salary advances: Dr Staff Advances / Cr Cash or Bank ──────────────────
  createAdvance(input, ctx) {
    return inTransaction(null, async (session) => {
      const staff = await staffService.getActive(input.staffId, ctx.scope, session);
      const branchId = String(staff.branchId);
      const branch = await branchService.getActive(branchId, session);
      const account = await cashOrBank(input.paymentAccountId, session);
      const advancesAccount = await accountService.getSystem(K.STAFF_ADVANCES, { session });
      const { voucher } = await voucherService.postVoucher(
        {
          vType: 'payment',
          date: input.date,
          branchId,
          party: { kind: 'staff', id: staff._id, name: staff.name },
          narration: input.notes ?? `Salary advance — ${staff.name}`,
          lines: [
            { accountId: advancesAccount._id, debit: input.amount },
            { accountId: account._id, credit: input.amount },
          ],
        },
        ctx,
        { session, source: 'hr' },
      );
      const seq = await nextSequence(`advance:${branchId}`, session);
      return advanceRepository.create(
        {
          ...input,
          advanceNo: branchDocNo('ADV', seq, branch.code, input.date),
          staffName: staff.name,
          branchId,
          voucherId: voucher._id,
          voucherNo: voucher.voucherNo,
          createdBy: ctx.user.id,
          updatedBy: ctx.user.id,
        },
        session,
      );
    });
  },

  async listAdvances(query, scope) {
    const { page, limit, skip } = paginate(query);
    const filter = { ...scope.filter() };
    if (query.status) filter.status = query.status;
    if (query.staffId) filter.staffId = query.staffId;
    const sort = parseSort(query.sort, ['date', 'createdAt'], { date: -1 });
    const [items, total] = await Promise.all([
      advanceRepository.find(filter, { skip, limit, sort }),
      advanceRepository.count(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },

  // ── Payroll runs ──────────────────────────────────────────────────────────

  // Draft for every active staff member of the branch. Open advances are
  // recovered automatically (as much as the pay allows).
  async createRun(input, ctx) {
    const branchId = ctx.scope.writeBranch(input.branchId);
    const branch = await branchService.getActive(branchId);
    const existing = await repo.findOne({
      branchId,
      period: input.period,
      status: { $ne: 'cancelled' },
    });
    if (existing)
      throw ApiError.conflict(`Payroll for ${input.period} already exists (${existing.runNo})`);

    const staff = await staffService.activeInBranch(branchId);
    if (!staff.length) throw ApiError.unprocessable('This branch has no active staff');
    const advances = await openAdvances(staff.map((s) => s._id));
    const lines = staff.map((s) => {
      const basic = s.monthlySalary ?? 0;
      const allowances = s.allowances ?? 0;
      const advanceRecovery = Math.min(
        remainingOf(advances.get(String(s._id))),
        round2(basic + allowances),
      );
      return computeLine({
        staffId: s._id,
        staffName: s.name,
        basic,
        allowances,
        otherDeductions: 0,
        advanceRecovery,
      });
    });

    const seq = await nextSequence(`payroll:${branchId}`);
    return repo.create({
      runNo: branchDocNo('PR', seq, branch.code, `${input.period}-01`),
      period: input.period,
      branchId,
      lines,
      totals: totalsOf(lines),
      createdBy: ctx.user.id,
      updatedBy: ctx.user.id,
    });
  },

  async updateLines(id, input, ctx) {
    const run = await loadRun(id, ctx.scope);
    if (run.status !== 'draft') throw ApiError.unprocessable('Only draft payroll can be changed');
    const advances = await openAdvances(run.lines.map((l) => l.staffId));
    const changes = new Map(input.lines.map((l) => [l.staffId, l]));
    const lines = run.lines.map((line) => {
      const change = changes.get(String(line.staffId));
      if (!change) return line.toObject();
      const next = { ...line.toObject(), ...change, staffId: line.staffId };
      if (next.advanceRecovery > remainingOf(advances.get(String(line.staffId)))) {
        throw ApiError.unprocessable(`${line.staffName} does not owe that much in advances`);
      }
      return computeLine(next);
    });
    run.lines = lines;
    run.totals = totalsOf(lines);
    run.updatedBy = ctx.user.id;
    return run.save();
  },

  /**
   * Posts the payroll in one voucher:
   *   Dr Salary & Wages (gross)
   *   Cr Staff Advances (recovered) · Cr Payroll Deductions Payable · Cr Cash/Bank (net)
   * and marks recovered advances (oldest first).
   */
  postRun(id, input, ctx) {
    return inTransaction(null, async (session) => {
      const run = await loadRun(id, ctx.scope, session);
      if (run.status !== 'draft') throw ApiError.conflict(`This payroll is already ${run.status}`);
      const { gross, otherDeductions, advanceRecovery, net } = run.totals;
      const account = await cashOrBank(input.paymentAccountId, session);
      const get = (key) => accountService.getSystem(key, { session });

      const lines = [{ accountId: (await get(K.SALARY))._id, debit: gross }];
      if (advanceRecovery > 0)
        lines.push({ accountId: (await get(K.STAFF_ADVANCES))._id, credit: advanceRecovery });
      if (otherDeductions > 0)
        lines.push({ accountId: (await get(K.PAYROLL_PAYABLE))._id, credit: otherDeductions });
      if (net > 0) lines.push({ accountId: account._id, credit: net });

      const { voucher } = await voucherService.postVoucher(
        {
          vType: 'journal',
          date: input.date,
          branchId: String(run.branchId),
          narration: `Payroll ${run.period} — ${run.runNo}`,
          lines,
        },
        ctx,
        {
          session,
          source: 'hr',
          sourceRef: { refType: 'payroll', refId: run._id, refNo: run.runNo },
        },
      );

      const advances = await openAdvances(
        run.lines.map((l) => l.staffId),
        session,
      );
      for (const line of run.lines) {
        let toRecover = line.advanceRecovery;
        for (const advance of advances.get(String(line.staffId)) ?? []) {
          if (toRecover <= 0) break;
          const take = Math.min(toRecover, round2(advance.amount - advance.recoveredAmount));
          const done = round2(advance.recoveredAmount + take) >= advance.amount;
          await advanceRepository.addRecovery(
            advance._id,
            take,
            done ? 'recovered' : 'open',
            session,
          );
          toRecover = round2(toRecover - take);
        }
      }

      Object.assign(run, {
        status: 'posted',
        postedDate: input.date,
        paymentAccountId: account._id,
        voucherId: voucher._id,
        voucherNo: voucher.voucherNo,
        updatedBy: ctx.user.id,
      });
      await run.save({ session });
      return run;
    });
  },

  async cancelRun(id, ctx) {
    const run = await loadRun(id, ctx.scope);
    if (run.status !== 'draft') throw ApiError.unprocessable('Only draft payroll can be cancelled');
    run.status = 'cancelled';
    run.updatedBy = ctx.user.id;
    return run.save();
  },

  getRun: (id, scope) => loadRun(id, scope),

  async listRuns(query, scope) {
    const { page, limit, skip } = paginate(query);
    const filter = { ...scope.filter() };
    if (query.period) filter.period = query.period;
    if (query.status) filter.status = query.status;
    const sort = parseSort(query.sort, ['period', 'createdAt'], { period: -1 });
    const [items, total] = await Promise.all([
      repo.find(filter, { skip, limit, sort }),
      repo.count(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },
};
