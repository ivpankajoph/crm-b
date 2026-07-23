import EmailMarketingAuditLog from '../models/EmailMarketingAuditLog.js';

export const recordEmailMarketingAudit = async ({
  req,
  action,
  resourceType,
  resourceId = null,
  metadata = {},
}) =>
  EmailMarketingAuditLog.create({
    workspaceId: req.emailMarketing.workspaceId,
    actorUserId: req.user._id,
    action,
    resourceType,
    resourceId,
    metadata,
  });
