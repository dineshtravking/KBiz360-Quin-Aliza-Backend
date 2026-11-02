import { registerApprovalHandler } from '#modules/approvals/index.js';
import { adjustmentService } from './adjustment.service.js';

export { default as inventoryRoutes } from './inventory.routes.js';
export { inventoryService } from './inventory.service.js';

registerApprovalHandler('stock_adjustment', {
  async onApprove(request, ctx, session) {
    const adjustment = await adjustmentService.loadPending(request.payload.adjustmentId, session);
    await adjustmentService.apply(adjustment, ctx, session);
    return { refType: 'stock_adjustment', refId: adjustment._id, refNo: adjustment.adjustmentNo };
  },
  async onReject(request, ctx, session) {
    const adjustment = await adjustmentService.loadPending(request.payload.adjustmentId, session);
    adjustment.status = 'rejected';
    adjustment.decidedBy = ctx.user.id;
    adjustment.decidedAt = new Date();
    await adjustment.save({ session });
  },
});
