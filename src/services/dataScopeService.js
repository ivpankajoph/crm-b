import {
  getUserTeamMemberIds,
  resolveEffectiveAccess,
} from './accessControlService.js';
import { getDownlineUserIds, isAdminUser } from '../utils/hierarchy.js';

export const resolveUserDataScope = async (user, section, resolvedAccess = null) => {
  if (isAdminUser(user)) {
    return { scope: 'all', userIds: [], userFilter: {} };
  }

  const access = resolvedAccess || await resolveEffectiveAccess(user);
  const scope = access.scopes?.[section] || 'own';
  if (scope === 'all') return { scope, userIds: [], userFilter: {} };
  if (scope === 'none') {
    return {
      scope,
      userIds: [],
      userFilter: { _id: { $exists: false } },
    };
  }

  let userIds = [user._id];
  if (scope === 'team') {
    userIds = await getUserTeamMemberIds(user);
  } else if (scope === 'hierarchy') {
    userIds = await getDownlineUserIds(user._id);
  }

  const normalizedIds = Array.from(new Set(userIds.map(String)));
  return {
    scope,
    userIds: normalizedIds,
    userFilter: { _id: { $in: normalizedIds } },
  };
};

export const ownershipFilter = (visibility, field) => {
  if (visibility.scope === 'all') return {};
  if (visibility.scope === 'none') return { _id: { $exists: false } };
  return { [field]: { $in: visibility.userIds } };
};
