import mongoose from 'mongoose';
import { ApiError } from '#shared/utils/ApiError.js';
import { multiply, round2, sumMoney } from '#shared/utils/money.js';
import { inTransaction } from '#shared/db/transaction.js';
import { VOUCHER_STATUS } from '#shared/constants/enums.js';
import { accountService, SYSTEM_KEYS as K } from '#modules/accounts/index.js';
import { branchService } from '#modules/branches/index.js';
import { settingService } from '#modules/settings/index.js';
import { itemService } from '#modules/items/index.js';
import { masterServices } from '#modules/masters/index.js';
import { inventoryService } from '#modules/inventory/index.js';
import { voucherService } from '#modules/vouchers/index.js';

const SALE_VTYPES = ['cashsale', 'creditsale'];

const system = (key, session, branchId) => accountService.getSystem(key, { session, branchId });

export const saleService = {
  /**
   * POS / cash sale / credit sale, all in one transaction:
   * stock leaves the godown at moving-average cost, and one voucher posts
   *   cash:   Dr Cash (USD or CDF)  / Cr Sales  (+ FX gain/loss for CDF)
   *   credit: Dr Accounts Receivable / Cr Sales
   *   always: Dr COGS / Cr Stock
   */
  createSale(input, ctx) {
    return inTransaction(null, async (session) => {
      const branchId = ctx.scope.writeBranch(input.branchId);
      const branch = await branchService.getActive(branchId, session);
      await settingService.assertPeriodOpen(input.date, session);
      const godown = await inventoryService.resolveGodown(branchId, input.godownId, session);
      const items = await itemService.getActiveMany(
        input.items.map((i) => i.itemId),
        session,
      );
      const client = input.clientId
        ? await masterServices.clients.getActive(input.clientId, session)
        : null;
      const isCredit = input.saleType === 'credit';

      const lines = input.items.map((i) => {
        const item = items.get(i.itemId);
        const unitPrice = round2(i.unitPrice ?? item.salesPrice);
        if (!(unitPrice > 0)) throw ApiError.badRequest(`${item.name} has no sales price`);
        return { item, qty: i.qty, unitPrice, amount: multiply(i.qty, unitPrice) };
      });
      const belowFloor = lines.filter(
        (l) => l.item.priceFloor > 0 && l.unitPrice < l.item.priceFloor,
      );
      if (belowFloor.length) {
        throw ApiError.unprocessable('Some prices are below the minimum price set by Head Office', {
          code: 'BELOW_PRICE_FLOOR',
          items: belowFloor.map((l) => ({
            itemId: String(l.item._id),
            name: l.item.name,
            unitPrice: l.unitPrice,
            priceFloor: l.item.priceFloor,
          })),
        });
      }
      const total = sumMoney(lines.map((l) => l.amount));

      const vType = isCredit ? 'creditsale' : 'cashsale';
      const voucherId = new mongoose.Types.ObjectId();
      const voucherNo = await voucherService.reserveNumber(vType, branch, input.date, session);
      const movements = await inventoryService.applyMovements(
        lines.map((l) => ({
          type: 'sale',
          itemId: l.item._id,
          qty: l.qty,
          godownId: godown._id,
          branchId,
          date: input.date,
          ref: { type: 'voucher', id: voucherId, no: voucherNo },
        })),
        { session, userId: ctx.user.id },
      );
      const cogs = sumMoney(movements.map((m) => m.value));

      const accountLines = [];
      let narration = input.narration;
      if (isCredit) {
        accountLines.push({ accountId: (await system(K.RECEIVABLES, session))._id, debit: total });
      } else if (input.paymentCurrency === 'CDF') {
        // Customer pays CDF at the sales rate; the books value that cash at the
        // accounting rate. The difference is an FX gain or loss.
        const fx = await settingService.getFx(session);
        const cdf = round2(total * fx.cdfSalesRate);
        const booked = round2(cdf / fx.cdfAccountingRate);
        const cash = await system(K.CASH_CDF, session, branchId);
        accountLines.push({
          accountId: cash._id,
          debit: booked,
          fcAmount: cdf,
          fcCurrency: 'CDF',
          fxRate: fx.cdfAccountingRate,
        });
        const diff = round2(booked - total);
        if (diff > 0)
          accountLines.push({ accountId: (await system(K.FX_GAIN, session))._id, credit: diff });
        if (diff < 0)
          accountLines.push({ accountId: (await system(K.FX_LOSS, session))._id, debit: -diff });
        narration ??= `Cash sale ${cdf} CDF @ ${fx.cdfSalesRate}`;
      } else {
        accountLines.push({
          accountId: (await system(K.CASH_USD, session, branchId))._id,
          debit: total,
        });
      }
      accountLines.push({ accountId: (await system(K.SALES, session))._id, credit: total });
      if (cogs > 0) {
        accountLines.push(
          { accountId: (await system(K.COGS, session))._id, debit: cogs },
          { accountId: (await system(K.STOCK, session))._id, credit: cogs },
        );
      }

      const { voucher } = await voucherService.postVoucher(
        {
          vType,
          date: input.date,
          branchId,
          party: client ? { kind: 'client', id: client._id, name: client.name } : undefined,
          narration,
          reference: input.reference,
          dueDate: input.dueDate,
          lines: accountLines,
          confirmCreditLimit: input.confirmCreditLimit,
        },
        ctx,
        {
          session,
          source: 'sales',
          amountsInBaseCurrency: true,
          voucherId,
          voucherNo,
          godownId: godown._id,
          invoiceAmount: isCredit ? total : 0,
          items: lines.map((l, index) => ({
            itemId: l.item._id,
            itemName: l.item.name,
            unit: l.item.unit,
            qty: l.qty,
            unitPrice: l.unitPrice,
            amount: l.amount,
            unitCost: movements[index].unitCost,
            costAmount: movements[index].value,
          })),
        },
      );
      return voucher;
    });
  },

  /**
   * Sales return (credit note). Goods come back at their original cost:
   *   Dr Sales Returns / Cr Accounts Receivable (credit sale) or Cash USD (cash sale)
   *   Dr Stock / Cr COGS
   */
  createReturn(saleId, input, ctx) {
    return inTransaction(null, async (session) => {
      const sale = await voucherService.getById(saleId, ctx.scope, session);
      if (!SALE_VTYPES.includes(sale.vType) || sale.status !== VOUCHER_STATUS.POSTED) {
        throw ApiError.badRequest('Only posted cash or credit sales can be returned');
      }
      await settingService.assertPeriodOpen(input.date, session);
      const returned = voucherService.checkReturnable(sale, input.items);
      const branchId = String(sale.branchId);
      const branch = await branchService.getActive(branchId, session);

      const voucherId = new mongoose.Types.ObjectId();
      const voucherNo = await voucherService.reserveNumber(
        'creditnote',
        branch,
        input.date,
        session,
      );
      const movements = await inventoryService.applyMovements(
        returned.map((r) => ({
          type: 'sales_return',
          itemId: r.itemId,
          qty: r.qty,
          unitCost: r.unitCost,
          godownId: sale.godownId,
          branchId,
          date: input.date,
          ref: { type: 'voucher', id: voucherId, no: voucherNo },
          notes: `Return of ${sale.voucherNo}`,
        })),
        { session, userId: ctx.user.id },
      );
      const amounts = returned.map((r) => multiply(r.qty, r.unitPrice));
      const total = sumMoney(amounts);
      const cost = sumMoney(movements.map((m) => m.value));
      const isCredit = sale.vType === 'creditsale';

      const refundAccount = isCredit
        ? await system(K.RECEIVABLES, session)
        : await system(K.CASH_USD, session, branchId);
      const accountLines = [
        { accountId: (await system(K.SALES_RETURNS, session))._id, debit: total },
        { accountId: refundAccount._id, credit: total },
      ];
      if (cost > 0) {
        accountLines.push(
          { accountId: (await system(K.STOCK, session))._id, debit: cost },
          { accountId: (await system(K.COGS, session))._id, credit: cost },
        );
      }

      const { voucher } = await voucherService.postVoucher(
        {
          vType: 'creditnote',
          date: input.date,
          branchId,
          party: voucherService.partyOf(sale),
          narration: input.notes || `Return of ${sale.voucherNo}`,
          lines: accountLines,
        },
        ctx,
        {
          session,
          source: 'sales',
          amountsInBaseCurrency: true,
          voucherId,
          voucherNo,
          godownId: sale.godownId,
          returnOf: sale._id,
          items: returned.map((r, index) => ({
            itemId: r.itemId,
            itemName: r.itemName,
            unit: r.unit,
            qty: r.qty,
            unitPrice: r.unitPrice,
            amount: amounts[index],
            unitCost: movements[index].unitCost,
            costAmount: movements[index].value,
          })),
        },
      );
      if (isCredit) await voucherService.reduceOutstanding(sale._id, total, session);
      await voucherService.recordItemReturns(sale._id, input.items, session);
      return voucher;
    });
  },

  list(query, scope) {
    const vTypeQuery = query.saleType
      ? { vType: query.saleType === 'cash' ? 'cashsale' : 'creditsale' }
      : {};
    return voucherService.list({ ...query, ...vTypeQuery, partyId: query.clientId }, scope, {
      vTypes: SALE_VTYPES,
    });
  },

  async getById(id, scope) {
    const voucher = await voucherService.getById(id, scope);
    if (!SALE_VTYPES.includes(voucher.vType)) throw ApiError.notFound('Sale not found');
    return voucher;
  },
};
