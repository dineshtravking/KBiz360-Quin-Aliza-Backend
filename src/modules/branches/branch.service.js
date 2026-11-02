import { ApiError } from '#shared/utils/ApiError.js';
import { buildMeta, paginate, parseSort, searchFilter } from '#shared/utils/pagination.js';
import { inTransaction } from '#shared/db/transaction.js';
import { accountService } from '#modules/accounts/index.js';
import { masterServices } from '#modules/masters/index.js';
import { branchRepository } from './branch.repository.js';

export const branchService = {
  // Users only see the branches they are allowed to work in.
  async list(query, scope) {
    const { page, limit, skip } = paginate(query);
    const filter = searchFilter(query.search, ['name', 'code', 'shortName']);
    if (query.isActive !== 'all') filter.isActive = query.isActive === 'true';
    if (scope.allowedBranchIds) filter._id = { $in: scope.allowedBranchIds };
    const sort = parseSort(query.sort, ['name', 'code', 'createdAt'], { name: 1 });
    const [items, total] = await Promise.all([
      branchRepository.find(filter, { skip, limit, sort }),
      branchRepository.count(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },

  async getById(id, scope, session) {
    const branch = await branchRepository.findById(id, session);
    if (!branch) throw ApiError.notFound('Branch not found');
    scope?.assertAccess(branch._id);
    return branch;
  },

  async getActive(id, session) {
    const branch = await branchRepository.findById(id, session);
    if (!branch || !branch.isActive) throw ApiError.badRequest('Branch not found or inactive');
    return branch;
  },

  async assertAllExist(ids) {
    if (!ids?.length) return;
    const found = await branchRepository.findByIds(ids);
    if (found.length !== new Set(ids.map(String)).size) {
      throw ApiError.badRequest('One or more branches do not exist');
    }
  },

  // Creating a branch also creates (in one transaction):
  // its USD + CDF cash accounts, a default godown and a default cost centre.
  async create(data, user, { session } = {}) {
    if (data.type === 'head_office' && (await branchRepository.findOne({ type: 'head_office' }))) {
      throw ApiError.conflict('A head office already exists');
    }
    return inTransaction(session, async (s) => {
      const userId = user?.id;
      const branch = await branchRepository.create(
        { ...data, createdBy: userId, updatedBy: userId },
        s,
      );
      const godown = await masterServices.godowns.createInternal(
        { name: `${data.name} Warehouse`, code: data.code, branchId: branch._id, isDefault: true },
        { session: s, userId },
      );
      await masterServices.costCentres.createInternal(
        { name: `CC - ${data.name}`, code: data.code, branchId: branch._id },
        { session: s, userId },
      );
      await accountService.ensureBranchCashAccounts(branch, { session: s, userId });
      branch.defaultGodownId = godown._id;
      await branch.save({ session: s });
      return branch;
    });
  },

  async update(id, data, user) {
    const branch = await branchService.getById(id);
    if (data.type === 'head_office' && branch.type !== 'head_office') {
      throw ApiError.unprocessable('There can only be one head office');
    }
    return branchRepository.update(id, { ...data, updatedBy: user.id });
  },

  async setActive(id, isActive, user) {
    const branch = await branchService.getById(id);
    if (branch.type === 'head_office' && !isActive) {
      throw ApiError.unprocessable('The head office cannot be deactivated');
    }
    return branchRepository.update(id, { isActive, updatedBy: user.id });
  },

  findByCode: (code) => branchRepository.findOne({ code }),
  listAll: () => branchRepository.findAll(),
};
