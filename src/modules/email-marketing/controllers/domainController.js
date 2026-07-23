import { errorResponse, successResponse } from '../../../utils/response.js';
import EmailMarketingCampaign from '../models/EmailMarketingCampaign.js';
import EmailMarketingDomain from '../models/EmailMarketingDomain.js';
import EmailMarketingWorkspace from '../models/EmailMarketingWorkspace.js';
import { recordEmailMarketingAudit } from '../services/auditService.js';
import {
  assertVerifiedSender,
  registerDomain,
  removeDomainIdentity,
  verifyDomainIdentity,
} from '../services/domainService.js';
import { buildWorkspaceFilter } from '../services/workspaceService.js';

export const listDomains = async (req, res, next) => {
  try {
    const items = await EmailMarketingDomain.find(
      buildWorkspaceFilter(req.emailMarketing),
    )
      .sort({ updatedAt: -1 })
      .lean();
    return successResponse(res, 200, 'Sending domains fetched successfully', { items });
  } catch (error) {
    return next(error);
  }
};

export const getDomain = async (req, res, next) => {
  try {
    const domain = await EmailMarketingDomain.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    ).lean();
    if (!domain) return errorResponse(res, 404, 'Sending domain not found');
    return successResponse(res, 200, 'Sending domain fetched successfully', domain);
  } catch (error) {
    return next(error);
  }
};

export const createDomain = async (req, res, next) => {
  try {
    const domain = await registerDomain({
      req,
      input: req.validated.body.domain,
    });
    await recordEmailMarketingAudit({
      req,
      action: 'domain.created',
      resourceType: 'sending_domain',
      resourceId: domain._id,
      metadata: { domain: domain.domain },
    });
    return successResponse(res, 201, 'Sending domain created successfully', domain);
  } catch (error) {
    return next(error);
  }
};

export const verifyDomain = async (req, res, next) => {
  try {
    const domain = await verifyDomainIdentity({
      req,
      domainId: req.validated.params.id,
    });
    await recordEmailMarketingAudit({
      req,
      action: 'domain.verified',
      resourceType: 'sending_domain',
      resourceId: domain._id,
      metadata: { status: domain.status },
    });
    return successResponse(res, 200, 'Domain verification completed', domain);
  } catch (error) {
    return next(error);
  }
};

export const deleteDomain = async (req, res, next) => {
  try {
    const domain = await EmailMarketingDomain.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    ).lean();
    if (!domain) return errorResponse(res, 404, 'Sending domain not found');
    const inUse = await EmailMarketingCampaign.exists({
      workspaceId: req.emailMarketing.workspaceId,
      fromEmail: new RegExp(`@${domain.domain.replace(/\./g, '\\.')}$`, 'i'),
      status: { $in: ['active', 'scheduled', 'sending', 'paused'] },
    });
    if (inUse) {
      return errorResponse(
        res,
        409,
        'Pause, archive, or finish campaigns using this domain before deleting it',
      );
    }
    const removedDomain = await removeDomainIdentity({
      req,
      domainId: req.validated.params.id,
    });
    return successResponse(res, 200, 'Sending domain deleted successfully', {
      id: removedDomain._id,
    });
  } catch (error) {
    return next(error);
  }
};

export const listVerifiedSenders = async (req, res, next) => {
  try {
    const domains = await EmailMarketingDomain.find(
      buildWorkspaceFilter(req.emailMarketing, { status: 'verified' }),
    )
      .select('domain trackingSubdomain verifiedAt')
      .sort({ domain: 1 })
      .lean();
    return successResponse(res, 200, 'Verified senders fetched successfully', {
      domains,
      senders: domains.map((domain) => ({
        domainId: domain._id,
        email: `info@${domain.domain}`,
        domain: domain.domain,
      })),
      defaults: req.emailMarketing.workspace.settings,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateSenderDefaults = async (req, res, next) => {
  try {
    await assertVerifiedSender(
      req.emailMarketing,
      req.validated.body.defaultFromEmail,
    );
    const workspace = await EmailMarketingWorkspace.findOneAndUpdate(
      { _id: req.emailMarketing.workspaceId, status: 'active' },
      {
        $set: {
          'settings.defaultFromName': req.validated.body.defaultFromName,
          'settings.defaultFromEmail': req.validated.body.defaultFromEmail,
          'settings.defaultReplyTo': req.validated.body.defaultReplyTo,
          updatedBy: req.user._id,
        },
      },
      { new: true, runValidators: true },
    );
    return successResponse(res, 200, 'Sender defaults updated successfully', workspace);
  } catch (error) {
    return next(error);
  }
};

export const getDomainHealth = async (req, res, next) => {
  try {
    const domain = await EmailMarketingDomain.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    );
    if (!domain) return errorResponse(res, 404, 'Sending domain not found');
    const campaigns = await EmailMarketingCampaign.find({
      workspaceId: req.emailMarketing.workspaceId,
      fromEmail: new RegExp(`@${domain.domain.replace(/\./g, '\\.')}$`, 'i'),
    })
      .select('metrics')
      .lean();
    const totals = campaigns.reduce(
      (sum, campaign) => ({
        sent: sum.sent + (campaign.metrics?.sent || 0),
        delivered: sum.delivered + (campaign.metrics?.delivered || 0),
        bounces: sum.bounces + (campaign.metrics?.bounces || 0),
        complaints: sum.complaints + (campaign.metrics?.complaints || 0),
      }),
      { sent: 0, delivered: 0, bounces: 0, complaints: 0 },
    );
    domain.health = {
      reputation: totals.sent
        ? Math.max(0, 100 - (totals.bounces / totals.sent) * 100 * 4)
        : 0,
      deliveryRate: totals.sent ? (totals.delivered / totals.sent) * 100 : 0,
      bounceRate: totals.sent ? (totals.bounces / totals.sent) * 100 : 0,
      complaintRate: totals.sent ? (totals.complaints / totals.sent) * 100 : 0,
    };
    domain.updatedBy = req.user._id;
    await domain.save();
    return successResponse(res, 200, 'Domain health fetched successfully', domain.health);
  } catch (error) {
    return next(error);
  }
};

export const requestDedicatedIp = async (req, res, next) => {
  try {
    const domain = await EmailMarketingDomain.findOneAndUpdate(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
      {
        $set: {
          'dedicatedIp.status': 'requested',
          'dedicatedIp.notes': req.validated.body.notes,
          'dedicatedIp.requestedAt': new Date(),
          updatedBy: req.user._id,
        },
      },
      { new: true, runValidators: true },
    );
    if (!domain) return errorResponse(res, 404, 'Sending domain not found');
    return successResponse(res, 200, 'Dedicated IP request recorded', domain);
  } catch (error) {
    return next(error);
  }
};
