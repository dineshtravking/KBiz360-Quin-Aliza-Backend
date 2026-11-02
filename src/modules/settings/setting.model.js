import mongoose from 'mongoose';
import { documentSchema, ref, subSchema } from '#shared/db/schema.js';

const fxHistorySchema = subSchema({
  at: { type: Date, default: Date.now },
  by: ref('User'),
  cdfAccountingRate: Number,
  cdfSalesRate: Number,
});

// One document (key "global") holds company-wide settings.
const settingSchema = documentSchema({
  key: { type: String, required: true, unique: true, default: 'global' },
  fx: {
    // Rate used in the books (frontend: fx.CDF).
    cdfAccountingRate: { type: Number, default: 2800, min: 0.0001 },
    // Rate shown to POS customers (frontend: fx.CDF_sales).
    cdfSalesRate: { type: Number, default: 2800, min: 0.0001 },
  },
  fxHistory: { type: [fxHistorySchema], default: [] },
  financialYear: {
    start: { type: String, default: '2026-01-01' },
    end: { type: String, default: '2026-12-31' },
  },
  // 'YYYY-MM' periods where no voucher can be posted or voided.
  lockedPeriods: { type: [String], default: [] },
  tax: {
    tvaRate: { type: Number, default: 16 },
    applyTvaOnSales: { type: Boolean, default: false },
  },
  inventory: {
    allowNegativeStock: { type: Boolean, default: false },
  },
});

export const Setting = mongoose.model('Setting', settingSchema);
