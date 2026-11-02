import { ApiError } from '#shared/utils/ApiError.js';
import { buildMeta, paginate, parseSort, searchFilter } from '#shared/utils/pagination.js';
import { accountRepository } from './account.repository.js';
import {
  CASH_AND_BANK_GROUPS,
  CASH_AND_BANK_KEYS,
  PRIMARY_GROUPS,
  SYSTEM_ACCOUNTS,
  branchCashAccounts,
  natureOfGroup,
} from './account.constants.js';

export const accountService = {
  listGroups: () => PRIMARY_GROUPS,

  async list(query, scope) {
    const { page, limit, skip } = paginate(query);
    const filter = searchFilter(query.search, ['name', 'code', 'groupName']);
    if (query.isActive !== 'all') filter.isActive = query.isActive === 'true';
    if (query.primaryGroup) filter.primaryGroup = query.primaryGroup;
    if (query.nature) filter.nature = query.nature;
    if (query.branchId) filter.branchId = query.branchId;
    // Branch cash accounts of other branches are hidden from branch users.
    if (scope.allowedBranchIds) {
      filter.$and = [{ $or: [{ branchId: null }, { branchId: { $in: scope.allowedBranchIds } }] }];
    }
    const sort = parseSort(query.sort, ['name', 'code', 'primaryGroup'], {
      primaryGroup: 1,
      name: 1,
    });
    const [items, total] = await Promise.all([
      accountRepository.find(filter, { skip, limit, sort }),
      accountRepository.count(filter),
    ]);
    return { items, meta: buildMeta({ page, limit }, total) };
  },

  async getById(id, session) {
    const account = await accountRepository.findById(id, session);
    if (!account) throw ApiError.notFound('Account not found');
    return account;
  },

  // For voucher posting: all accounts must exist and be active. Returns a Map by id.
  async getForPosting(ids, session) {
    const unique = [...new Set(ids.map(String))];
    const accounts = await accountRepository.findByIds(unique, session);
    const byId = new Map(accounts.map((a) => [String(a._id), a]));
    const missing = unique.filter((id) => !byId.get(id)?.isActive);
    if (missing.length) {
      throw ApiError.badRequest('Some accounts do not exist or are inactive', {
        accountIds: missing,
      });
    }
    return byId;
  },

  // System accounts are looked up by key. A missing one means the seed was not run.
  async getSystem(systemKey, { branchId, session } = {}) {
    const account = await accountRepository.findSystem(systemKey, branchId, session);
    if (!account) {
      throw ApiError.internal(
        `System account "${systemKey}"${branchId ? ' for this branch' : ''} is missing. Run npm run seed.`,
      );
    }
    return account;
  },

  isCashOrBank: (account) =>
    CASH_AND_BANK_KEYS.includes(account.systemKey) ||
    CASH_AND_BANK_GROUPS.includes(account.groupName),

  create(data, user) {
    const nature = natureOfGroup(data.primaryGroup);
    return accountRepository.create({ ...data, nature, createdBy: user.id, updatedBy: user.id });
  },

  async update(id, data, user) {
    const account = await accountService.getById(id);
    const changes = { ...data, updatedBy: user.id };
    if (account.isSystem) {
      // The system relies on these, so their type and owner branch are fixed.
      if (data.primaryGroup && data.primaryGroup !== account.primaryGroup) {
        throw ApiError.unprocessable('The group of a system account cannot be changed');
      }
      delete changes.branchId;
      delete changes.currency;
    }
    if (changes.primaryGroup) changes.nature = natureOfGroup(changes.primaryGroup);
    return accountRepository.update(id, changes);
  },

  async setActive(id, isActive, user) {
    const account = await accountService.getById(id);
    if (account.isSystem && !isActive) {
      throw ApiError.unprocessable('System accounts cannot be deactivated');
    }
    return accountRepository.update(id, { isActive, updatedBy: user.id });
  },

  // Seed + branch creation: make sure every system account exists.
  async ensureSystemAccounts({ session, userId } = {}) {
    for (const def of SYSTEM_ACCOUNTS) {
      await accountRepository.upsertSystem(
        { currency: 'USD', ...def, nature: natureOfGroup(def.primaryGroup) },
        { session, userId },
      );
    }
  },

  async ensureBranchCashAccounts(branch, { session, userId } = {}) {
    for (const def of branchCashAccounts(branch)) {
      await accountRepository.upsertSystem(
        { ...def, nature: natureOfGroup(def.primaryGroup) },
        { session, userId },
      );
    }
  },

  listAll: (filter) => accountRepository.findAll(filter),
};
