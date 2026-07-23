import { buildWorkspaceFilter } from '../services/workspaceService.js';

export const escapeRegex = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const conditionToMongo = (condition, now = new Date()) => {
  const field = condition.field === 'tag' ? 'tags' : condition.field;
  const value = condition.value.trim();

  if (condition.operator === 'within_days') {
    const days = Number(value);
    return {
      createdAt: {
        $gte: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
      },
    };
  }

  const exact = new RegExp(`^${escapeRegex(value)}$`, 'i');
  const contains = new RegExp(escapeRegex(value), 'i');

  if (condition.operator === 'equals') return { [field]: exact };
  if (condition.operator === 'not_equals') return { [field]: { $not: exact } };
  if (condition.operator === 'contains') return { [field]: contains };
  if (condition.operator === 'not_contains') {
    return { [field]: { $not: contains } };
  }

  throw new Error(`Unsupported segment operator: ${condition.operator}`);
};

export const buildSegmentFilter = (
  emailMarketingContext,
  definition,
  now = new Date(),
) => {
  const conditions = definition.conditions.map((condition) =>
    conditionToMongo(condition, now),
  );
  const operator = definition.logic === 'or' ? '$or' : '$and';
  return buildWorkspaceFilter(emailMarketingContext, { [operator]: conditions });
};
