// The 15 primary groups (same as the frontend's Tally-style chart of accounts).
// `nature` decides where an account appears: assets/liabilities/equity → Balance
// Sheet, income/expense → Profit & Loss.
export const PRIMARY_GROUPS = [
  { no: 1, name: 'Capital Account', nature: 'equity' },
  { no: 2, name: 'Reserves & Surplus', nature: 'equity' },
  { no: 3, name: 'Loans (Liability)', nature: 'liability' },
  { no: 4, name: 'Current Liabilities', nature: 'liability' },
  { no: 5, name: 'Fixed Assets', nature: 'asset' },
  { no: 6, name: 'Investments', nature: 'asset' },
  { no: 7, name: 'Current Assets', nature: 'asset' },
  { no: 8, name: 'Branch / Divisions', nature: 'asset' },
  { no: 9, name: 'Suspense Account', nature: 'asset' },
  { no: 10, name: 'Sales Accounts', nature: 'income' },
  { no: 11, name: 'Direct Income', nature: 'income' },
  { no: 12, name: 'Indirect Income', nature: 'income' },
  { no: 13, name: 'Purchase Accounts', nature: 'expense' },
  { no: 14, name: 'Direct Expenses', nature: 'expense' },
  { no: 15, name: 'Indirect Expenses', nature: 'expense' },
];

export const natureOfGroup = (no) => PRIMARY_GROUPS.find((g) => g.no === no)?.nature;

// Accounts the system posts to automatically. Code finds them by `systemKey`,
// never by name, so renaming an account can never break a posting.
export const SYSTEM_KEYS = {
  CASH_USD: 'cash_usd',
  CASH_CDF: 'cash_cdf',
  BANK_USD: 'bank_usd',
  BANK_CDF: 'bank_cdf',
  RECEIVABLES: 'receivables',
  PAYABLES: 'payables',
  STOCK: 'stock',
  STAFF_ADVANCES: 'staff_advances',
  IMPORT_CLEARING: 'import_clearing',
  PAYROLL_PAYABLE: 'payroll_payable',
  SALES: 'sales',
  SALES_RETURNS: 'sales_returns',
  PURCHASE: 'purchase',
  COGS: 'cogs',
  STOCK_ADJUSTMENT: 'stock_adjustment',
  SALARY: 'salary',
  FX_GAIN: 'fx_gain',
  FX_LOSS: 'fx_loss',
  OPENING_EQUITY: 'opening_equity',
};

const K = SYSTEM_KEYS;

// Company-wide system accounts (names match the frontend chart of accounts).
export const SYSTEM_ACCOUNTS = [
  {
    systemKey: K.BANK_USD,
    name: 'Bank Account - USD',
    primaryGroup: 7,
    groupName: 'Bank Accounts',
  },
  {
    systemKey: K.BANK_CDF,
    name: 'Bank Account - CDF',
    primaryGroup: 7,
    groupName: 'Bank Accounts',
    currency: 'CDF',
  },
  {
    systemKey: K.RECEIVABLES,
    name: 'Accounts Receivable',
    primaryGroup: 7,
    groupName: 'Sundry Debtors',
  },
  { systemKey: K.STOCK, name: 'Stock / Inventory', primaryGroup: 7, groupName: 'Stock-in-Hand' },
  {
    systemKey: K.STAFF_ADVANCES,
    name: 'Staff Advances',
    primaryGroup: 7,
    groupName: 'Loans & Advances',
  },
  {
    systemKey: K.PAYABLES,
    name: 'Accounts Payable',
    primaryGroup: 4,
    groupName: 'Sundry Creditors',
  },
  {
    systemKey: K.IMPORT_CLEARING,
    name: 'Import Clearing (Goods Received)',
    primaryGroup: 4,
    groupName: 'Current Liabilities',
  },
  {
    systemKey: K.PAYROLL_PAYABLE,
    name: 'Payroll Deductions Payable',
    primaryGroup: 4,
    groupName: 'Duties & Provisions',
  },
  { systemKey: K.SALES, name: 'Sales Revenue', primaryGroup: 10, groupName: 'Sales Accounts' },
  {
    systemKey: K.SALES_RETURNS,
    name: 'Sales Returns',
    primaryGroup: 10,
    groupName: 'Sales Accounts',
  },
  { systemKey: K.PURCHASE, name: 'Purchase', primaryGroup: 13, groupName: 'Purchase Accounts' },
  { systemKey: K.COGS, name: 'Cost of Goods Sold', primaryGroup: 14, groupName: 'Direct Expenses' },
  {
    systemKey: K.STOCK_ADJUSTMENT,
    name: 'Stock Adjustment',
    primaryGroup: 14,
    groupName: 'Direct Expenses',
  },
  { systemKey: 'import_duty', name: 'Import Duty', primaryGroup: 14, groupName: 'Direct Expenses' },
  {
    systemKey: 'clearing_charges',
    name: 'Clearing Agent Charges',
    primaryGroup: 14,
    groupName: 'Direct Expenses',
  },
  {
    systemKey: 'freight',
    name: 'Freight / Transport',
    primaryGroup: 14,
    groupName: 'Direct Expenses',
  },
  { systemKey: K.SALARY, name: 'Salary & Wages', primaryGroup: 15, groupName: 'Indirect Expenses' },
  { systemKey: 'rent', name: 'Rent', primaryGroup: 15, groupName: 'Indirect Expenses' },
  {
    systemKey: 'utilities',
    name: 'Electricity & Utilities',
    primaryGroup: 15,
    groupName: 'Indirect Expenses',
  },
  {
    systemKey: 'bank_charges',
    name: 'Bank Charges',
    primaryGroup: 15,
    groupName: 'Indirect Expenses',
  },
  {
    systemKey: 'other_expenses',
    name: 'Other Expenses',
    primaryGroup: 15,
    groupName: 'Indirect Expenses',
  },
  {
    systemKey: K.FX_LOSS,
    name: 'Foreign Exchange Loss',
    primaryGroup: 15,
    groupName: 'Indirect Expenses',
  },
  {
    systemKey: 'depreciation',
    name: 'Depreciation Expense',
    primaryGroup: 15,
    groupName: 'Indirect Expenses',
  },
  {
    systemKey: 'other_income',
    name: 'Other Income',
    primaryGroup: 12,
    groupName: 'Indirect Income',
  },
  {
    systemKey: K.FX_GAIN,
    name: 'Foreign Exchange Gain',
    primaryGroup: 12,
    groupName: 'Indirect Income',
  },
  { systemKey: 'fixed_assets', name: 'Fixed Assets', primaryGroup: 5, groupName: 'Fixed Assets' },
  {
    systemKey: 'accumulated_depreciation',
    name: 'Accumulated Depreciation',
    primaryGroup: 5,
    groupName: 'Fixed Assets',
  },
  { systemKey: 'capital', name: 'Capital Account', primaryGroup: 1, groupName: 'Capital Account' },
  {
    systemKey: K.OPENING_EQUITY,
    name: 'Opening Balance Equity',
    primaryGroup: 2,
    groupName: 'Reserves & Surplus',
  },
];

// Every branch gets its own USD and CDF cash account, e.g. "Cash S1 $" / "Cash S1 FC".
export const branchCashAccounts = (branch) =>
  [
    { systemKey: K.CASH_USD, name: `Cash ${branch.code} $`, currency: 'USD' },
    { systemKey: K.CASH_CDF, name: `Cash ${branch.code} FC`, currency: 'CDF' },
  ].map((a) => ({ ...a, primaryGroup: 7, groupName: 'Cash-in-Hand', branchId: branch._id }));

// Accounts money can be paid from or received into.
export const CASH_AND_BANK_KEYS = [K.CASH_USD, K.CASH_CDF, K.BANK_USD, K.BANK_CDF];
export const CASH_AND_BANK_GROUPS = ['Cash-in-Hand', 'Bank Accounts'];
