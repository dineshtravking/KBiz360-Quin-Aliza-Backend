import { ApiError } from '#shared/utils/ApiError.js';
import { APPROVAL_STATUS } from '#shared/constants/enums.js';
import { inTransaction } from '#shared/db/transaction.js';
import { buildMeta, paginate, parseSort } from '#shared/utils/pagination.js';
import { approvalRepository } from './approval.repository.js';

// Other modules register what happens when their request type is approved/rejected:
//   registerApprovalHandler('voucher', { onApprove(request, ctx, session), onReject? })
// onApprove returns { refType, refId, refNo } describing what it created.
// This keeps approvals independent: it never imports the modules that use it.
const handlers = new Map();

export function registerApprovalHandler(type, handler) {
  handlers.set(type, handler);
}

const canDecide = (user) => user.role.isSuperAdmin || user.role.canApprove;

export const approvalService = {
  createRequest({ type, branchId, title, amount, payload }, user, session) {
    return approvalRepository.create(
      {
        type,
        branchId,
        title,
        amount,
        payload,
        requestedBy: user.id,
        requestedByName: user.name,
        createdBy: user.id,
        updatedBy: user.id,
      },
      session,
    );
  },

  async list(query, scope) {
    const { page, limit, skip } = paginate(query);
    const filter = { ...scope.filter() };
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    const sort = parseSort(query.sort, ['createdAt', 'amount'], { createdAt: -1 });
    const [items, total] = await Promise.all([
      approvalRepository.find(filter, { skip, limit, sort }),
      approvalRepository.count(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },

  async getById(id, scope) {
    const request = await approvalRepository.findById(id);
    if (!request) throw ApiError.notFound('Approval request not found');
    if (request.branchId) scope.assertAccess(request.branchId);
    return request;
  },

  countPending: (scope) =>
    approvalRepository.count({ ...scope.filter(), status: APPROVAL_STATUS.PENDING }),

  // Approving runs the registered action (e.g. posts the voucher) in the same
  // transaction: if the action fails, the request stays pending.
  approve(id, note, ctx) {
    return decide(id, ctx, async (request, session) => {
      const handler = handlers.get(request.type);
      if (!handler) throw ApiError.internal(`No approval handler for "${request.type}"`);
      request.result = await handler.onApprove(request, ctx, session);
      request.status = APPROVAL_STATUS.APPROVED;
      request.decisionNote = note;
    });
  },

  reject(id, note, ctx) {
    return decide(id, ctx, async (request, session) => {
      await handlers.get(request.type)?.onReject?.(request, ctx, session);
      request.status = APPROVAL_STATUS.REJECTED;
      request.decisionNote = note;
    });
  },
};

async function decide(id, ctx, action) {
  const { user, scope } = ctx;
  if (!canDecide(user)) throw ApiError.forbidden('Only an approver (General Manager) can decide');

  return inTransaction(null, async (session) => {
    const request = await approvalRepository.findById(id, session);
    if (!request) throw ApiError.notFound('Approval request not found');
    if (request.branchId) scope.assertAccess(request.branchId);
    if (request.status !== APPROVAL_STATUS.PENDING) {
      throw ApiError.conflict(`This request is already ${request.status}`);
    }
    // Nobody approves their own request (except the Super Admin).
    if (String(request.requestedBy) === String(user.id) && !user.role.isSuperAdmin) {
      throw ApiError.forbidden('You cannot decide on your own request');
    }
    await action(request, session);
    request.decidedBy = user.id;
    request.decidedByName = user.name;
    request.decidedAt = new Date();
    request.updatedBy = user.id;
    await request.save({ session });
    return request;
  });
}
