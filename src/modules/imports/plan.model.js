import mongoose from 'mongoose';
import { documentSchema, ref, subSchema } from '#shared/db/schema.js';
import { IMPORT_ROUTES } from '#shared/constants/enums.js';

const planItemSchema = subSchema(
  {
    itemId: ref('Item', { required: true }),
    itemName: String,
    unit: String,
    plannedQty: { type: Number, required: true },
    targetFob: Number, // target price per unit (USD)
  },
  { id: true },
);

// A bulk import plan, delivered through one or more shipments.
const planSchema = documentSchema({
  planNo: { type: String, required: true, unique: true },
  route: { type: String, enum: IMPORT_ROUTES, required: true },
  name: { type: String, required: true },
  branchId: ref('Branch', { required: true, index: true }),
  supplierId: ref('Supplier'),
  supplierName: String,
  country: String,
  createdDate: { type: String, required: true },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active',
    index: true,
  },
  notes: String,
  items: { type: [planItemSchema], required: true },
});

export const ImportPlan = mongoose.model('ImportPlan', planSchema);
