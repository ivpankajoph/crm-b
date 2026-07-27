const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const parseDateParam = (value, { endOfDay = false } = {}) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
};

export const parsePagination = (query = {}) => {
  const requestedPage = Number.parseInt(query.page, 10);
  const requestedLimit = Number.parseInt(query.limit, 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Math.min(
    Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    search: String(query.search || '').trim().slice(0, 100),
    sortOrder,
  };
};

export const safeSort = (query, allowedFields, fallback = 'createdAt') => {
  const sortBy = allowedFields.includes(query.sortBy) ? query.sortBy : fallback;
  return { [sortBy]: query.sortOrder === 'asc' ? 1 : -1, _id: query.sortOrder === 'asc' ? 1 : -1 };
};

export const paginationMeta = ({ page, limit, total }) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  return {
    page: safePage,
    requestedPage: page,
    limit,
    total,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrevious: safePage > 1,
  };
};

export const pagedData = (items, pagination, facets = {}) => ({
  items,
  pagination,
  facets,
});
