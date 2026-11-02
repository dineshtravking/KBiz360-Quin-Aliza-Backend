import { Router } from 'express';
import { databaseStatus } from '#config/database.js';
import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { blockReadOnly } from '#shared/middlewares/permission.middleware.js';
import { branchScope } from '#shared/middlewares/branchScope.middleware.js';
import { authenticate, authRoutes } from '#modules/auth/index.js';
import { userRoutes } from '#modules/users/index.js';
import { roleRoutes } from '#modules/roles/index.js';
import { branchRoutes } from '#modules/branches/index.js';
import { settingRoutes } from '#modules/settings/index.js';
import { masterResources } from '#modules/masters/index.js';
import { itemRoutes } from '#modules/items/index.js';
import { accountRoutes } from '#modules/accounts/index.js';
import { voucherRoutes } from '#modules/vouchers/index.js';
import { approvalRoutes } from '#modules/approvals/index.js';
import { inventoryRoutes } from '#modules/inventory/index.js';
import { saleRoutes } from '#modules/sales/index.js';
import { purchaseRoutes } from '#modules/purchases/index.js';
import { planRoutes, shipmentRoutes } from '#modules/imports/index.js';
import { hrRoutes } from '#modules/hr/index.js';
import { reportRoutes } from '#modules/reports/index.js';
import { auditLogRoutes } from '#modules/audit-logs/index.js';

const router = Router();

// ── Public ──────────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json(
    new ApiResponse({
      status: 'up',
      database: databaseStatus(),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }),
  );
});

router.use('/auth', authRoutes);

// ── Everything below needs a logged-in user ─────────────────────────────────
// 1. who is calling  2. view-only users cannot change data  3. which branches they see
router.use(authenticate, blockReadOnly, branchScope);

router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/branches', branchRoutes);
router.use('/settings', settingRoutes);
for (const [path, resource] of Object.entries(masterResources)) {
  router.use(`/${path}`, resource.router);
}
router.use('/items', itemRoutes);
router.use('/accounts', accountRoutes);
router.use('/vouchers', voucherRoutes);
router.use('/approvals', approvalRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/sales', saleRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/import-plans', planRoutes);
router.use('/shipments', shipmentRoutes);
router.use('/hr', hrRoutes);
router.use('/reports', reportRoutes);
router.use('/audit-logs', auditLogRoutes);

export default router;
