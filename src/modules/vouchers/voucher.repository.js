import mongoose from 'mongoose';
import { round2 } from '#shared/utils/money.js';
import { Voucher } from './voucher.model.js';

const toId = (id) => new mongoose.Types.ObjectId(String(id));
const hasBalance = { $expr: { $gt: ['$invoiceAmount', '$settledAmount'] } };

export const voucherRepository = {
  find: (filter, { skip, limit, sort }) => Voucher.find(filter).sort(sort).skip(skip).limit(limit),
  count: (filter) => Voucher.countDocuments(filter),
  findById: (id, session) => Voucher.findById(id).session(session ?? null),
  create: (data, session) => new Voucher(data).save({ session }),

  incSettled: (id, amount, session) =>
    Voucher.updateOne({ _id: id }, { $inc: { settledAmount: amount } }, { session }),

  incReturnedQty: (id, itemId, qty, session) =>
    Voucher.updateOne(
      { _id: id, 'items.itemId': itemId },
      { $inc: { 'items.$.returnedQty': qty } },
      { session },
    ),

  findOpenInvoices: (filter) =>
    Voucher.find({ ...filter, status: 'posted', ...hasBalance }).sort({ date: 1 }),

  // Total still owed by one customer/supplier on the given invoice types.
  async outstandingForParty(partyId, vTypes, session) {
    const [row] = await Voucher.aggregate([
      { $match: { 'party.id': toId(partyId), vType: { $in: vTypes }, status: 'posted' } },
      {
        $group: { _id: null, total: { $sum: { $subtract: ['$invoiceAmount', '$settledAmount'] } } },
      },
    ]).session(session ?? null);
    return round2(row?.total ?? 0);
  },

  // Debit/credit totals per account for posted vouchers matching `match`.
  accountTotals: (match) =>
    Voucher.aggregate([
      { $match: { status: 'posted', ...match } },
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$lines.accountId',
          debit: { $sum: '$lines.debit' },
          credit: { $sum: '$lines.credit' },
        },
      },
    ]),

  // Every posted line of one account, oldest first.
  ledgerLines: (accountId, match, limit) =>
    Voucher.aggregate([
      { $match: { status: 'posted', 'lines.accountId': toId(accountId), ...match } },
      { $unwind: '$lines' },
      { $match: { 'lines.accountId': toId(accountId) } },
      { $sort: { date: 1, createdAt: 1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          voucherId: '$_id',
          voucherNo: 1,
          vType: 1,
          date: 1,
          branchId: 1,
          party: '$party.name',
          narration: { $ifNull: ['$lines.narration', '$narration'] },
          debit: '$lines.debit',
          credit: '$lines.credit',
        },
      },
    ]),

  aggregate: (pipeline) => Voucher.aggregate(pipeline),
};
