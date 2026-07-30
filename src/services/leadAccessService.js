import { resolveEffectiveAccess, getUserTeamMemberIds } from './accessControlService.js';
import { getDownlineUserIds, isAdminUser } from '../utils/hierarchy.js';
import mongoose from 'mongoose';

export const resolveLeadVisibility = async (user, resolvedAccess = null) => {
  if (isAdminUser(user)) {
    return { scope: 'all', userIds: [], query: {} };
  }

  const access = resolvedAccess || await resolveEffectiveAccess(user);
  const scope = access.scopes?.leads || 'own';

  if (scope === 'all') return { scope, userIds: [], query: {} };
  if (scope === 'none') {
    return { scope, userIds: [], query: { _id: { $exists: false } } };
  }

  let userIds = [user._id];
  if (scope === 'team') {
    userIds = await getUserTeamMemberIds(user);
  } else if (scope === 'hierarchy') {
    userIds = await getDownlineUserIds(user._id);
  }
  userIds = userIds
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  return {
    scope,
    userIds,
    query: {
      assignedTo: { $in: userIds },
    },
  };
};
