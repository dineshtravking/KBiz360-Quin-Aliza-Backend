import { z } from 'zod';
import { BRANCH_TYPES, IMPORT_ROUTES } from '#shared/constants/enums.js';
import { activeFilter, listQuery, name, shortText } from '#shared/utils/schemas.js';

export const createBranchSchema = z
  .object({
    name,
    shortName: shortText.optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{1,8}$/, 'Code must be 1-8 letters or digits'),
    type: z.enum(BRANCH_TYPES).default('branch'),
    cargoTypes: z.array(z.enum(IMPORT_ROUTES)).default([]),
    address: shortText.optional(),
    city: shortText.optional(),
    phone: shortText.optional(),
    color: shortText.optional(),
  })
  .strict();

// The code is used in document numbers, so it cannot be changed.
export const updateBranchSchema = createBranchSchema.omit({ code: true }).partial();

export const listBranchesSchema = listQuery.extend({ isActive: activeFilter });
