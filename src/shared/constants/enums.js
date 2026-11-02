// Fixed lists used across modules. Values match the frontend where it has one.

export const BASE_CURRENCY = 'USD';
export const CURRENCIES = ['USD', 'CDF'];

// Product lines (item.productType)
export const PRODUCT_TYPES = ['pt_hd', 'pt_mf', 'pt_mo'];
export const PRODUCT_TYPE_CODES = { pt_hd: 'HD', pt_mf: 'MF', pt_mo: 'MO' };

// Import routes (frontend: impoType)
export const IMPORT_ROUTES = ['HD', 'MTL', 'AIR'];

export const BRANCH_TYPES = ['head_office', 'branch', 'shop'];

export const VOUCHER_TYPES = [
  'cashsale',
  'creditsale',
  'sales',
  'purchase',
  'receipt',
  'payment',
  'expense',
  'contra',
  'journal',
  'debitnote',
  'creditnote',
];

// Cash and credit sales are created through /sales so stock and COGS are handled too.
export const MANUAL_VOUCHER_TYPES = VOUCHER_TYPES.filter(
  (t) => !['cashsale', 'creditsale'].includes(t),
);

// Vouchers that create something a customer/supplier owes (can be settled by receipts/payments).
export const INVOICE_TYPES = ['cashsale', 'creditsale', 'sales', 'purchase'];
export const SALE_TYPES = ['cashsale', 'creditsale', 'sales'];

export const VOUCHER_PREFIX = {
  cashsale: 'CS',
  creditsale: 'SCR',
  sales: 'SI',
  purchase: 'PI',
  receipt: 'RV',
  payment: 'PV',
  expense: 'EV',
  contra: 'CV',
  journal: 'JV',
  debitnote: 'DN',
  creditnote: 'CN',
};

export const VOUCHER_STATUS = { POSTED: 'posted', VOIDED: 'voided' };

// Which module created a voucher. Only 'manual' vouchers can be voided directly.
export const VOUCHER_SOURCES = ['manual', 'sales', 'purchases', 'inventory', 'imports', 'hr'];

export const PARTY_TYPES = ['client', 'supplier', 'transporter', 'custom_agency', 'staff'];

export const STOCK_IN_TYPES = [
  'opening',
  'purchase',
  'import_receipt',
  'transfer_in',
  'adjust_in',
  'sales_return',
];
export const STOCK_OUT_TYPES = ['sale', 'transfer_out', 'adjust_out', 'purchase_return'];
export const STOCK_MOVEMENT_TYPES = [...STOCK_IN_TYPES, ...STOCK_OUT_TYPES];

export const APPROVAL_STATUS = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };
