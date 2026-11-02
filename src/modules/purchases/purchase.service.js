import mongoose from 'mongoose';
import { ApiError } from '#shared/utils/ApiError.js';
import { sumMoney } from '#shared/utils/money.js';
import { inTransaction } from '#shared/db/transaction.js';
import { VOUCHER_STATUS } from '#shared/constants/enums.js';
import { accountService, SYSTEM_KEYS as K } from '#modules/accounts/index.js';
import { branchService } from '#modules/branches/index.js';
import { settingService } from '#modules/settings/index.js';
import { itemService } from '#modules/items/index.js';
import { masterServices } from '#modules/masters/index.js';
import { inventoryService } from '#modules/inventory/index.js';
import { voucherService } from '#modules/vouchers/index.js';

async function paymentAccount(id, session) {
  const account = await accountService.getById(id, session);
  if (!account.isActive || !accountService.isCashOrBank(account)) {
    throw ApiError.badRequest('Payment account must be an active cash or bank account');
  }
  return account;
}

const itemLines = (movements) =>
  movements.map((m) => ({
    itemId: m.itemId,
    itemName: m.itemName,
    unit: m.unit,
    qty: m.qty,
    unitPrice: m.unitCost,
    amount: m.value,
    unitCost: m.unitCost,
    costAmount: m.value,
  }));

export const purchaseService = {
  /**
   * Local stock purchase: stock comes in at the purchase cost, and
   *   Dr Stock / Cr Accounts Payable (credit) or Cr Cash/Bank (cash).
   */
  create(input, ctx) {
    return inTransaction(null, async (session) => {
      const branchId = ctx.scope.writeBranch(input.branchId);
      const branch = await branchService.getActive(branchId, session);
      await settingService.assertPeriodOpen(input.date, session);
      const godown = await inventoryService.resolveGodown(branchId, input.godownId, session);
      const supplier = await masterServices.suppliers.getActive(input.supplierId, session);
      await itemService.getActiveMany(
        input.items.map((i) => i.itemId),
        session,
      );
      const isCredit = input.paymentMode === 'credit';
      const creditAccount = isCredit
        ? await accountService.getSystem(K.PAYABLES, { session })
        : await paymentAccount(input.paymentAccountId, session);

      const voucherId = new mongoose.Types.ObjectId();
      const voucherNo = await voucherService.reserveNumber('purchase', branch, input.date, session);
      const movements = await inventoryService.applyMovements(
        input.items.map((i) => ({
          type: 'purchase',
          itemId: i.itemId,
          qty: i.qty,
          unitCost: i.unitCost,
          godownId: godown._id,
          branchId,
          date: input.date,
          ref: { type: 'voucher', id: voucherId, no: voucherNo },
        })),
        { session, userId: ctx.user.id },
      );
      const total = sumMoney(movements.map((m) => m.value));
      if (total <= 0) throw ApiError.badRequest('The purchase total must be more than zero');
      const stock = await accountService.getSystem(K.STOCK, { session });

      const { voucher } = await voucherService.postVoucher(
        {
          vType: 'purchase',
          date: input.date,
          branchId,
          party: { kind: 'supplier', id: supplier._id, name: supplier.name },
          narration: input.narration ?? `Purchase from ${supplier.name}`,
          reference: input.reference,
          dueDate: input.dueDate,
          lines: [
            { accountId: stock._id, debit: total },
            { accountId: creditAccount._id, credit: total },
          ],
        },
        ctx,
        {
          session,
          source: 'purchases',
          voucherId,
          voucherNo,
          godownId: godown._id,
          invoiceAmount: isCredit ? total : 0,
          items: itemLines(movements),
        },
      );
      return voucher;
    });
  },

  /**
   * Purchase return (debit note). Goods leave at their original purchase cost:
   *   Dr Accounts Payable (or the cash/bank account paid from) / Cr Stock.
   */
  createReturn(purchaseId, input, ctx) {
    return inTransaction(null, async (session) => {
      const purchase = await voucherService.getById(purchaseId, ctx.scope, session);
      if (
        purchase.vType !== 'purchase' ||
        purchase.source !== 'purchases' ||
        purchase.status !== VOUCHER_STATUS.POSTED
      ) {
        throw ApiError.badRequest('Only posted stock purchases can be returned');
      }
      await settingService.assertPeriodOpen(input.date, session);
      const returned = voucherService.checkReturnable(purchase, input.items);
      const branchId = String(purchase.branchId);
      const branch = await branchService.getActive(branchId, session);

      const voucherId = new mongoose.Types.ObjectId();
      const voucherNo = await voucherService.reserveNumber(
        'debitnote',
        branch,
        input.date,
        session,
      );
      const movements = await inventoryService.applyMovements(
        returned.map((r) => ({
          type: 'purchase_return',
          itemId: r.itemId,
          qty: r.qty,
          unitCost: r.unitCost,
          godownId: purchase.godownId,
          branchId,
          date: input.date,
          ref: { type: 'voucher', id: voucherId, no: voucherNo },
          notes: `Return of ${purchase.voucherNo}`,
        })),
        { session, userId: ctx.user.id },
      );
      const total = sumMoney(movements.map((m) => m.value));
      const isCredit = purchase.invoiceAmount > 0;
      const stock = await accountService.getSystem(K.STOCK, { session });
      // Money comes back to the account the purchase was credited to.
      const refundAccountId = purchase.lines.find((l) => l.credit > 0).accountId;

      const { voucher } = await voucherService.postVoucher(
        {
          vType: 'debitnote',
          date: input.date,
          branchId,
          party: voucherService.partyOf(purchase),
          narration: input.notes || `Return of ${purchase.voucherNo}`,
          lines: [
            { accountId: refundAccountId, debit: total },
            { accountId: stock._id, credit: total },
          ],
        },
        ctx,
        {
          session,
          source: 'purchases',
          voucherId,
          voucherNo,
          godownId: purchase.godownId,
          returnOf: purchase._id,
          items: itemLines(movements),
        },
      );
      if (isCredit) await voucherService.reduceOutstanding(purchase._id, total, session);
      await voucherService.recordItemReturns(purchase._id, input.items, session);
      return voucher;
    });
  },

  list(query, scope) {
    return voucherService.list({ ...query, vType: 'purchase', partyId: query.supplierId }, scope);
  },

  async getById(id, scope) {
    const voucher = await voucherService.getById(id, scope);
    if (voucher.vType !== 'purchase') throw ApiError.notFound('Purchase not found');
    return voucher;
  },
};
