import { z } from 'zod';
import { PRODUCT_TYPES } from '#shared/constants/enums.js';
import {
  amount,
  currency,
  dateString,
  email,
  longText,
  name,
  objectId,
  shortText,
} from '#shared/utils/schemas.js';

const contactFields = {
  phone: shortText.optional(),
  email: email.optional(),
  address: shortText.optional(),
  notes: longText.optional(),
};

export const clientSchema = z
  .object({
    name,
    code: shortText.optional(),
    city: shortText.optional(),
    taxId: shortText.optional(),
    creditLimit: amount.optional(),
    paymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
    priceListId: objectId.optional(),
    ...contactFields,
  })
  .strict();

export const supplierSchema = z
  .object({
    name,
    country: shortText.optional(),
    contact: shortText.optional(),
    currency: currency.optional(),
    paymentTerms: shortText.optional(),
    ...contactFields,
  })
  .strict();

export const transporterSchema = z
  .object({
    name,
    country: shortText.optional(),
    contact: shortText.optional(),
    drivers: z
      .array(
        z.object({ name, phone: shortText.optional(), licenseNo: shortText.optional() }).strict(),
      )
      .max(100)
      .optional(),
    ...contactFields,
  })
  .strict();

export const customAgencySchema = z
  .object({
    name,
    country: shortText.optional(),
    contact: shortText.optional(),
    registrationNo: shortText.optional(),
    ...contactFields,
  })
  .strict();

export const godownSchema = z
  .object({
    name,
    code: shortText.optional(),
    branchId: objectId.optional(),
    address: shortText.optional(),
    city: shortText.optional(),
    contact: shortText.optional(),
    notes: longText.optional(),
  })
  .strict();

export const costCentreSchema = z
  .object({
    name,
    code: shortText.optional(),
    branchId: objectId.optional(),
    description: longText.optional(),
  })
  .strict();

export const bankAccountSchema = z
  .object({
    name,
    bankName: shortText.optional(),
    accountNumber: shortText.optional(),
    swift: shortText.optional(),
    currency: currency.optional(),
    branchId: objectId.optional(),
    ledgerAccountId: objectId.optional(),
    notes: longText.optional(),
  })
  .strict();

export const taxCodeSchema = z
  .object({
    name,
    code: shortText.optional(),
    rate: z.coerce.number().min(0).max(100),
    description: longText.optional(),
  })
  .strict();

export const priceListSchema = z
  .object({
    name,
    currency: currency.optional(),
    validFrom: dateString.optional(),
    validTo: dateString.optional(),
    items: z
      .array(z.object({ itemId: objectId, price: amount }).strict())
      .max(5000)
      .optional(),
  })
  .strict();

export const leaveTypeSchema = z
  .object({
    name,
    code: shortText.optional(),
    daysPerYear: z.coerce.number().min(0).max(366).optional(),
    isPaid: z.boolean().optional(),
  })
  .strict();

export const payrollComponentSchema = z
  .object({
    name,
    kind: z.enum(['earning', 'deduction']),
    calcType: z.enum(['fixed', 'percent']).optional(),
    amount: amount.optional(),
  })
  .strict();

export const itemCategorySchema = z
  .object({
    name,
    code: shortText.optional(),
    productType: z.enum(PRODUCT_TYPES).optional(),
    parentId: objectId.optional(),
    description: longText.optional(),
  })
  .strict();

export const productTypeFilter = { productType: z.enum(PRODUCT_TYPES).optional() };
