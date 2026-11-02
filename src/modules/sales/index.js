// Sales has no collection of its own: a sale is a voucher (cashsale / creditsale)
// with item lines, and its stock movements live in the inventory ledger.
export { default as saleRoutes } from './sale.routes.js';
export { saleService } from './sale.service.js';
