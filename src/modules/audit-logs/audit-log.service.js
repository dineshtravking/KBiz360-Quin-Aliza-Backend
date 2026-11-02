import { AuditLog } from './audit-log.model.js';
import { buildMeta, paginate } from '#shared/utils/pagination.js';
import { logger } from '#config/logger.js';

export const auditLogService = {
  // Never lets an audit failure break the request that was already answered.
  async record(entry) {
    try {
      await AuditLog.create(entry);
    } catch (err) {
      logger.error({ err }, 'Could not write audit log');
    }
  },

  async list(query) {
    const { page, limit, skip } = paginate(query);
    const filter = {};
    if (query.userId) filter.userId = query.userId;
    if (query.method) filter.method = query.method;
    if (query.from || query.to) {
      filter.at = {
        ...(query.from && { $gte: new Date(`${query.from}T00:00:00Z`) }),
        ...(query.to && { $lte: new Date(`${query.to}T23:59:59.999Z`) }),
      };
    }
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ at: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },
};
