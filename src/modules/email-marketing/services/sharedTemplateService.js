import ResourceAccess from '../../../models/ResourceAccess.js';
import {
  resolveAccountOwnerId,
  resolveEffectiveAccess,
} from '../../../services/accessControlService.js';

export const getSharedEmailTemplateIds = async (user, action = 'use') => {
  const [ownerUserId, access] = await Promise.all([
    resolveAccountOwnerId(user),
    resolveEffectiveAccess(user),
  ]);

  if (access.isAdmin) return null;

  const rows = await ResourceAccess.find({
    ownerUserId,
    resourceType: 'email_template',
    actions: action,
    $or: [
      { visibility: 'company' },
      { userIds: user._id },
      ...(access.roleId ? [{ roleIds: access.roleId }] : []),
      ...(access.teamIds.length ? [{ teamIds: { $in: access.teamIds } }] : []),
    ],
  })
    .select('resourceId')
    .lean();

  return rows.map((row) => row.resourceId);
};
