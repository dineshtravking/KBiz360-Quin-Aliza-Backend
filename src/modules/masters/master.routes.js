import { createMasterResource } from '#shared/crud/masterResource.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { Client } from './client.model.js';
import { Supplier } from './supplier.model.js';
import { Transporter } from './transporter.model.js';
import { CustomAgency } from './custom-agency.model.js';
import { Godown } from './godown.model.js';
import { CostCentre } from './cost-centre.model.js';
import { BankAccount } from './bank-account.model.js';
import {
  ItemCategory,
  LeaveType,
  PayrollComponent,
  PriceList,
  TaxCode,
} from './simple-masters.model.js';
import * as schemas from './master.validation.js';

const masters = { view: P.MASTERS_VIEW, manage: P.MASTERS_MANAGE };

// path → resource. Each one gets list/get/create/update/deactivate/reactivate.
export const masterResources = {
  clients: createMasterResource({
    Model: Client,
    label: 'Client',
    createSchema: schemas.clientSchema,
    permissions: { view: [P.MASTERS_VIEW, P.SALES_VIEW], manage: P.MASTERS_MANAGE },
    searchFields: ['name', 'code', 'phone', 'email'],
  }),
  suppliers: createMasterResource({
    Model: Supplier,
    label: 'Supplier',
    createSchema: schemas.supplierSchema,
    permissions: { view: [P.MASTERS_VIEW, P.IMPORTS_VIEW], manage: P.MASTERS_MANAGE },
    searchFields: ['name', 'country', 'email'],
  }),
  transporters: createMasterResource({
    Model: Transporter,
    label: 'Transporter',
    createSchema: schemas.transporterSchema,
    permissions: { view: [P.MASTERS_VIEW, P.IMPORTS_VIEW], manage: P.MASTERS_MANAGE },
  }),
  'custom-agencies': createMasterResource({
    Model: CustomAgency,
    label: 'Custom agency',
    createSchema: schemas.customAgencySchema,
    permissions: { view: [P.MASTERS_VIEW, P.IMPORTS_VIEW], manage: P.MASTERS_MANAGE },
  }),
  godowns: createMasterResource({
    Model: Godown,
    label: 'Godown',
    createSchema: schemas.godownSchema,
    permissions: { view: [P.MASTERS_VIEW, P.INVENTORY_VIEW], manage: P.MASTERS_MANAGE },
    branchScoped: true,
  }),
  'cost-centres': createMasterResource({
    Model: CostCentre,
    label: 'Cost centre',
    createSchema: schemas.costCentreSchema,
    permissions: { view: [P.MASTERS_VIEW, P.ACCOUNTS_VIEW], manage: P.MASTERS_MANAGE },
    branchScoped: true,
  }),
  'bank-accounts': createMasterResource({
    Model: BankAccount,
    label: 'Bank account',
    createSchema: schemas.bankAccountSchema,
    permissions: { view: [P.MASTERS_VIEW, P.ACCOUNTS_VIEW], manage: P.MASTERS_MANAGE },
  }),
  'tax-codes': createMasterResource({
    Model: TaxCode,
    label: 'Tax code',
    createSchema: schemas.taxCodeSchema,
    permissions: masters,
  }),
  'price-lists': createMasterResource({
    Model: PriceList,
    label: 'Price list',
    createSchema: schemas.priceListSchema,
    permissions: { view: [P.MASTERS_VIEW, P.SALES_VIEW], manage: P.MASTERS_MANAGE },
  }),
  'leave-types': createMasterResource({
    Model: LeaveType,
    label: 'Leave type',
    createSchema: schemas.leaveTypeSchema,
    permissions: { view: [P.MASTERS_VIEW, P.HR_VIEW], manage: P.MASTERS_MANAGE },
  }),
  'payroll-components': createMasterResource({
    Model: PayrollComponent,
    label: 'Payroll component',
    createSchema: schemas.payrollComponentSchema,
    permissions: { view: [P.MASTERS_VIEW, P.HR_VIEW], manage: P.MASTERS_MANAGE },
  }),
  'item-categories': createMasterResource({
    Model: ItemCategory,
    label: 'Item category',
    createSchema: schemas.itemCategorySchema,
    permissions: {
      view: [P.MASTERS_VIEW, P.ITEMS_VIEW],
      manage: [P.MASTERS_MANAGE, P.ITEMS_MANAGE],
    },
    filters: schemas.productTypeFilter,
  }),
};
