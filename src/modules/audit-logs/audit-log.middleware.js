import { auditLogService } from './audit-log.service.js';

const CHANGES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const OBJECT_ID = /^[a-f\d]{24}$/i;

// After every successful change, writes who did what. Bodies are never stored
// (they can contain passwords or salaries).
export function auditTrail(req, res, next) {
  if (!CHANGES.has(req.method)) return next();
  const started = Date.now();
  res.on('finish', () => {
    const user = req.user ?? res.locals.auditUser;
    if (!user || res.statusCode >= 400) return;
    const branchId = req.get('x-branch-id');
    auditLogService.record({
      userId: user.id,
      userName: user.name,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      branchId: branchId && OBJECT_ID.test(branchId) ? branchId : undefined,
      ip: req.ip,
      durationMs: Date.now() - started,
    });
  });
  next();
}
