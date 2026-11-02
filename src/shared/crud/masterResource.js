import { Router } from 'express';
import { ApiError } from '#shared/utils/ApiError.js';
import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { activeFilter, idParams, listQuery, objectId } from '#shared/utils/schemas.js';
import { buildMeta, paginate, parseSort, searchFilter } from '#shared/utils/pagination.js';

// Builds the standard API for simple master data (clients, suppliers, godowns...):
//   GET /, GET /:id, POST /, PATCH /:id, POST /:id/deactivate, POST /:id/reactivate
// The layers (repository → service → controller → routes) are kept separate inside.
// Use a full module instead when a master has real business rules.
export function createMasterResource({
  Model,
  label,
  createSchema,
  permissions,
  searchFields = ['name'],
  sortFields = ['name', 'createdAt'],
  branchScoped = false,
  filters = {},
}) {
  // ── Repository ────────────────────────────────────────────────────────────
  const repository = {
    find: (filter, { skip, limit, sort }) => Model.find(filter).sort(sort).skip(skip).limit(limit),
    count: (filter) => Model.countDocuments(filter),
    findById: (id, session) => Model.findById(id).session(session ?? null),
    findByIds: (ids, session) => Model.find({ _id: { $in: ids } }).session(session ?? null),
    create: (data, session) => new Model(data).save({ session }),
    update: (id, data) =>
      Model.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true }),
  };

  // ── Service ───────────────────────────────────────────────────────────────
  const service = {
    async list(query, scope) {
      const { page, limit, skip } = paginate(query);
      const filter = { ...searchFilter(query.search, searchFields) };
      if (query.isActive !== 'all') filter.isActive = query.isActive === 'true';
      if (branchScoped) {
        Object.assign(filter, scope.filter());
        if (query.branchId) {
          scope.assertAccess(query.branchId);
          filter.branchId = query.branchId;
        }
      }
      for (const key of Object.keys(filters)) {
        if (query[key] !== undefined) filter[key] = query[key];
      }
      const sort = parseSort(query.sort, sortFields, { name: 1 });
      const [items, total] = await Promise.all([
        repository.find(filter, { skip, limit, sort }),
        repository.count(filter),
      ]);
      return { items, meta: buildMeta({ page, limit }, total) };
    },

    async getById(id, scope, session) {
      const doc = await repository.findById(id, session);
      if (!doc) throw ApiError.notFound(`${label} not found`);
      if (branchScoped && scope) scope.assertAccess(doc.branchId);
      return doc;
    },

    // For other modules: the record must exist and be active.
    async getActive(id, session) {
      const doc = await repository.findById(id, session);
      if (!doc || !doc.isActive) throw ApiError.badRequest(`${label} not found or inactive`);
      return doc;
    },

    async getMany(ids, session) {
      const docs = await repository.findByIds(ids, session);
      return new Map(docs.map((d) => [String(d._id), d]));
    },

    async create(data, user, scope) {
      const doc = { ...data, createdBy: user.id, updatedBy: user.id };
      if (branchScoped) doc.branchId = scope.writeBranch(data.branchId);
      return repository.create(doc);
    },

    // For other modules and the seed script (no permission/scope checks).
    createInternal(data, { session, userId } = {}) {
      return repository.create({ ...data, createdBy: userId, updatedBy: userId }, session);
    },

    async update(id, data, user, scope) {
      await service.getById(id, scope);
      if (branchScoped && data.branchId) scope.assertAccess(data.branchId);
      return repository.update(id, { ...data, updatedBy: user.id });
    },

    async setActive(id, isActive, user, scope) {
      await service.getById(id, scope);
      return repository.update(id, { isActive, updatedBy: user.id });
    },
  };

  // ── Controller ────────────────────────────────────────────────────────────
  const controller = {
    async list(req, res) {
      const { items, meta } = await service.list(req.valid.query, req.scope);
      res.json(new ApiResponse(items, 'OK', meta));
    },
    async get(req, res) {
      res.json(new ApiResponse(await service.getById(req.valid.params.id, req.scope)));
    },
    async create(req, res) {
      const doc = await service.create(req.valid.body, req.user, req.scope);
      res.status(201).json(new ApiResponse(doc, `${label} created`));
    },
    async update(req, res) {
      const doc = await service.update(req.valid.params.id, req.valid.body, req.user, req.scope);
      res.json(new ApiResponse(doc, `${label} updated`));
    },
    async deactivate(req, res) {
      const doc = await service.setActive(req.valid.params.id, false, req.user, req.scope);
      res.json(new ApiResponse(doc, `${label} deactivated`));
    },
    async reactivate(req, res) {
      const doc = await service.setActive(req.valid.params.id, true, req.user, req.scope);
      res.json(new ApiResponse(doc, `${label} reactivated`));
    },
  };

  // ── Routes ────────────────────────────────────────────────────────────────
  const listSchema = listQuery.extend({
    isActive: activeFilter,
    ...(branchScoped && { branchId: objectId.optional() }),
    ...filters,
  });
  // A permission can be one string or a list (any of them is enough).
  const canView = requirePermission(...[permissions.view].flat());
  const canManage = requirePermission(...[permissions.manage].flat());

  const router = Router();
  router.get('/', canView, validate({ query: listSchema }), controller.list);
  router.get('/:id', canView, validate({ params: idParams }), controller.get);
  router.post('/', canManage, validate({ body: createSchema }), controller.create);
  router.patch(
    '/:id',
    canManage,
    validate({ params: idParams, body: createSchema.partial() }),
    controller.update,
  );
  router.post('/:id/deactivate', canManage, validate({ params: idParams }), controller.deactivate);
  router.post('/:id/reactivate', canManage, validate({ params: idParams }), controller.reactivate);

  return { router, service };
}
