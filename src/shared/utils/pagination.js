import { ApiError } from './ApiError.js';

export function paginate(query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  return { page, limit, skip: (page - 1) * limit };
}

export function buildMeta({ page, limit }, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

// sort=-date → { date: -1 }. Only fields in `allowed` can be used.
export function parseSort(sort, allowed, fallback = { createdAt: -1 }) {
  if (!sort) return fallback;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  if (!allowed.includes(field)) {
    throw ApiError.badRequest(`Cannot sort by "${field}". Allowed: ${allowed.join(', ')}`);
  }
  return { [field]: desc ? -1 : 1, _id: desc ? -1 : 1 };
}

export const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function searchFilter(search, fields) {
  if (!search) return {};
  const pattern = new RegExp(escapeRegex(search), 'i');
  return { $or: fields.map((field) => ({ [field]: pattern })) };
}

export function dateRangeFilter({ from, to }, field = 'date') {
  if (!from && !to) return {};
  return { [field]: { ...(from && { $gte: from }), ...(to && { $lte: to }) } };
}
