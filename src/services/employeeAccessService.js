import User from '../models/User.js';
import {
  getUserTeamMemberIds,
  resolveEffectiveAccess,
} from './accessControlService.js';
import { getDownlineUserIds, isAdminUser } from '../utils/hierarchy.js';

export const buildEmployeeVisibilityQuery = ({
  scope,
  userIds = [],
  userEmails = [],
}) => {
  if (scope === 'all') return {};
  if (scope === 'none') return { _id: { $exists: false } };

  return {
    $or: [
      { user: { $in: userIds } },
      { email: { $in: userEmails } },
    ],
  };
};

export const resolveEmployeeVisibility = async (user, resolvedAccess = null) => {
  if (isAdminUser(user)) {
    return { scope: 'all', userIds: [], query: {} };
  }

  const access = resolvedAccess || await resolveEffectiveAccess(user);
  const scope = access.scopes?.employees || 'own';

  if (scope === 'all' || scope === 'none') {
    return {
      scope,
      userIds: [],
      query: buildEmployeeVisibilityQuery({ scope }),
    };
  }

  let userIds = [user._id];
  if (scope === 'team') {
    userIds = await getUserTeamMemberIds(user);
  } else if (scope === 'hierarchy') {
    userIds = await getDownlineUserIds(user._id);
  }

  const normalizedUserIds = userIds.map(String);
  const visibleUsers = await User.find({ _id: { $in: normalizedUserIds } })
    .select('_id email')
    .lean();
  const userEmails = visibleUsers
    .map((visibleUser) => visibleUser.email)
    .filter(Boolean);

  return {
    scope,
    userIds: normalizedUserIds,
    query: buildEmployeeVisibilityQuery({
      scope,
      userIds: normalizedUserIds,
      userEmails,
    }),
  };
};

export const combineEmployeeFilters = (visibilityQuery, filter = {}) => {
  if (!Object.keys(visibilityQuery || {}).length) return filter;
  if (!Object.keys(filter || {}).length) return visibilityQuery;
  return { $and: [visibilityQuery, filter] };
};
