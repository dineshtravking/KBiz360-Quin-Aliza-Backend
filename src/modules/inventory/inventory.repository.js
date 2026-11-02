import { StockMovement } from './movement.model.js';
import { StockBalance } from './balance.model.js';
import { StockTransfer } from './transfer.model.js';
import { StockAdjustment } from './adjustment.model.js';

export const inventoryRepository = {
  // ── Ledger ────────────────────────────────────────────────────────────────
  findBalance: (itemId, godownId, session) =>
    StockBalance.findOne({ itemId, godownId }).session(session ?? null),

  saveBalance: ({ itemId, godownId, ...data }, session) =>
    StockBalance.findOneAndUpdate(
      { itemId, godownId },
      { $set: data },
      { upsert: true, returnDocument: 'after', session },
    ),

  createMovement: (data, session) => new StockMovement(data).save({ session }),

  findMovements: (filter, { skip, limit, sort }) =>
    StockMovement.find(filter).sort(sort).skip(skip).limit(limit),
  countMovements: (filter) => StockMovement.countDocuments(filter),

  aggregateBalances: (pipeline) => StockBalance.aggregate(pipeline),
  aggregateMovements: (pipeline) => StockMovement.aggregate(pipeline),

  // ── Transfers ─────────────────────────────────────────────────────────────
  createTransfer: (data, session) => new StockTransfer(data).save({ session }),
  findTransferById: (id, session) => StockTransfer.findById(id).session(session ?? null),
  findTransfers: (filter, { skip, limit, sort }) =>
    StockTransfer.find(filter).sort(sort).skip(skip).limit(limit),
  countTransfers: (filter) => StockTransfer.countDocuments(filter),

  // ── Adjustments ───────────────────────────────────────────────────────────
  createAdjustment: (data, session) => new StockAdjustment(data).save({ session }),
  findAdjustmentById: (id, session) => StockAdjustment.findById(id).session(session ?? null),
  findAdjustments: (filter, { skip, limit, sort }) =>
    StockAdjustment.find(filter).sort(sort).skip(skip).limit(limit),
  countAdjustments: (filter) => StockAdjustment.countDocuments(filter),
};
