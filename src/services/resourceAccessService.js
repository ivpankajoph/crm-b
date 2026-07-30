import ResourceAccess from '../models/ResourceAccess.js';
import {
  resolveAccountOwnerId,
  resolveEffectiveAccess,
} from './accessControlService.js';

export const resolveResourceAccess = async ({
  user,
  resourceType,
  resourceId,
  action = 'use',
}) => {
  const ownerUserId = await resolveAccountOwnerId(user);
  const access = await resolveEffectiveAccess(user);

  if (access.isAdmin) {
    return { allowed: true, ownerUserId, access, sharing: null };
  }

  const sharing = await ResourceAccess.findOne({
    ownerUserId,
    resourceType,
    resourceId: String(resourceId),
    actions: action,
    $or: [
      { visibility: 'company' },
      { userIds: user._id },
      ...(access.roleId ? [{ roleIds: access.roleId }] : []),
      ...(access.teamIds.length ? [{ teamIds: { $in: access.teamIds } }] : []),
    ],
  }).lean();

  return {
    allowed: Boolean(sharing),
    ownerUserId,
    access,
    sharing,
  };
};
