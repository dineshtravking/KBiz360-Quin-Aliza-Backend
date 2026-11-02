import mongoose from 'mongoose';
import { masterSchema, ref } from '#shared/db/schema.js';
import { PRODUCT_TYPES } from '#shared/constants/enums.js';

const itemSchema = masterSchema({
  itemCode: { type: String, required: true, unique: true, trim: true }, // e.g. IC-HD0001
  name: { type: String, required: true, trim: true, unique: true },
  productType: { type: String, enum: PRODUCT_TYPES, required: true, index: true },
  categoryId: ref('ItemCategory'),
  origin: String,
  unit: { type: String, default: 'PCS' },
  sku: String,
  barcode: String,
  description: String,
  imageUrl: String,
  // USD. Default POS price.
  salesPrice: { type: Number, default: 0, min: 0 },
  // USD. Sales below this price are blocked (frontend: price floors).
  priceFloor: { type: Number, default: 0, min: 0 },
  // Low-stock alert level (per godown).
  reorderLevel: { type: Number, default: 0, min: 0 },
});

export const Item = mongoose.model('Item', itemSchema);
