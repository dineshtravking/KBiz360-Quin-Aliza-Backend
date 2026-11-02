import { z } from 'zod';
import { PRODUCT_TYPES } from '#shared/constants/enums.js';
import {
  activeFilter,
  amount,
  listQuery,
  longText,
  name,
  objectId,
  shortText,
} from '#shared/utils/schemas.js';

export const createItemSchema = z
  .object({
    itemCode: shortText.optional(), // generated when empty
    name,
    productType: z.enum(PRODUCT_TYPES),
    categoryId: objectId.optional(),
    origin: shortText.optional(),
    unit: shortText.optional(),
    sku: shortText.optional(),
    barcode: shortText.optional(),
    description: longText.optional(),
    imageUrl: z.string().url().max(500).optional(),
    salesPrice: amount.optional(),
    priceFloor: amount.optional(),
    reorderLevel: z.coerce.number().min(0).optional(),
  })
  .strict();

export const updateItemSchema = createItemSchema.omit({ itemCode: true }).partial();

export const listItemsSchema = listQuery.extend({
  isActive: activeFilter,
  productType: z.enum(PRODUCT_TYPES).optional(),
  categoryId: objectId.optional(),
});
