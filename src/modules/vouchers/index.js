import { registerApprovalHandler } from '#modules/approvals/index.js';
import { voucherService } from './voucher.service.js';

export { default as voucherRoutes } from './voucher.routes.js';
export { voucherService };

// When the approver accepts a big voucher, post it exactly as it was entered.
// The person who entered it stays the creator; the approver is recorded too.
registerApprovalHandler('voucher', {
  async onApprove(request, ctx, session) {
    const { input, requestedBy } = request.payload;
    const { voucher } = await voucherService.postVoucher(input, ctx, {
      session,
      skipApprovalLimit: true,
      createdBy: requestedBy,
      approval: { id: request._id, approvedBy: ctx.user.id },
    });
    return { refType: 'voucher', refId: voucher._id, refNo: voucher.voucherNo };
  },
});
