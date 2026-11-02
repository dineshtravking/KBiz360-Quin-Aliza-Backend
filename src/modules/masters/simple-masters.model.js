import mongoose from 'mongoose';
import { masterSchema, ref, subSchema } from '#shared/db/schema.js';
import { PRODUCT_TYPES } from '#shared/constants/enums.js';

// Small lookup masters with no business rules of their own.

export const TaxCode = mongoose.model(
  'TaxCode',
  masterSchema({
    name: { type: String, required: true, trim: true, unique: true },
    code: String,
    rate: { type: Number, required: true, min: 0, max: 100 },
    description: String,
  }),
);

const priceListItemSchema = subSchema({ itemId: ref('Item', { required: true }), price: Number });

export const PriceList = mongoose.model(
  'PriceList',
  masterSchema({
    name: { type: String, required: true, trim: true, unique: true },
    currency: { type: String, default: 'USD' },
    validFrom: String,
    validTo: String,
    items: { type: [priceListItemSchema], default: [] },
  }),
);

export const LeaveType = mongoose.model(
  'LeaveType',
  masterSchema({
    name: { type: String, required: true, trim: true, unique: true },
    code: String,
    daysPerYear: { type: Number, default: 0, min: 0 },
    isPaid: { type: Boolean, default: true },
  }),
);

export const PayrollComponent = mongoose.model(
  'PayrollComponent',
  masterSchema({
    name: { type: String, required: true, trim: true, unique: true },
    kind: { type: String, enum: ['earning', 'deduction'], required: true },
    calcType: { type: String, enum: ['fixed', 'percent'], default: 'fixed' },
    amount: { type: Number, default: 0, min: 0 },
  }),
);

export const ItemCategory = mongoose.model(
  'ItemCategory',
  masterSchema({
    name: { type: String, required: true, trim: true, unique: true },
    code: String,
    productType: { type: String, enum: PRODUCT_TYPES },
    parentId: ref('ItemCategory'),
    description: String,
  }),
);
