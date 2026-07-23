import { errorResponse, successResponse } from '../../../utils/response.js';
import EmailMarketingAuditLog from '../models/EmailMarketingAuditLog.js';
import EmailMarketingCampaign, {
  campaignGoals,
  campaignStatuses,
  campaignTypes,
} from '../models/EmailMarketingCampaign.js';
import EmailMarketingEvent from '../models/EmailMarketingEvent.js';
import EmailMarketingRecipient from '../models/EmailMarketingRecipient.js';
import EmailMarketingTemplate from '../models/EmailMarketingTemplate.js';
import { recordEmailMarketingAudit } from '../services/auditService.js';
import {
  normalizeCampaignPayload,
  validateCampaignDefinition,
} from '../services/campaignService.js';
import {
  renderTemplateHtml,
  renderTestCampaignEmail,
} from '../services/emailRenderService.js';
import {
  cancelCampaignDelivery,
  scheduleCampaignDelivery,
} from '../services/emailQueueService.js';
import { buildWorkspaceFilter } from '../services/workspaceService.js';
import { sendSesEmail } from '../services/sesService.js';
import { resolveEmailMarketingSender } from '../services/senderService.js';
import { calculateDelayMs } from '../utils/campaign.js';
import { escapeRegex } from '../utils/segmentFilter.js';

const editableStatuses = new Set(['draft', 'scheduled', 'paused', 'failed']);

export const sendCampaignTestEmail = async (req, res, next) => {
  try {
    const {
      recipientEmail,
      fromName,
      fromEmail,
      replyTo,
      subject,
      previewText,
      templateId,
    } = req.validated.body;
    const sender = await resolveEmailMarketingSender(req.emailMarketing, {
      requestedFromName: fromName,
      requestedFromEmail: fromEmail,
      requestedReplyTo: replyTo,
    });
    const template = await EmailMarketingTemplate.findOne(
      buildWorkspaceFilter(req.emailMarketing, {
        _id: templateId,
        status: { $ne: 'archived' },
      }),
    ).lean();
    if (!template) {
      return errorResponse(res, 400, 'Campaign template is unavailable');
    }
    if (!renderTemplateHtml(template)) {
      return errorResponse(res, 400, 'Campaign template has no email content');
    }

    const rendered = renderTestCampaignEmail({
      template,
      recipientEmail,
      subject,
      previewText,
    });
    const response = await sendSesEmail({
      fromName: sender.fromName,
      fromEmail: sender.fromEmail,
      replyTo: sender.replyTo,
      recipient: recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: {
        purpose: 'campaign-test',
        workspace: String(req.emailMarketing.workspaceId),
      },
    });
    await recordEmailMarketingAudit({
      req,
      action: 'campaign.test_email_sent',
      resourceType: 'campaign_test',
      metadata: {
        templateId,
        senderDomain: sender.domain,
        senderSource: sender.source,
        messageId: response.MessageId || '',
      },
    });
    return successResponse(res, 200, 'Campaign test email sent successfully', {
      messageId: response.MessageId || '',
      recipientEmail,
    });
  } catch (error) {
    return next(error);
  }
};

export const listCampaigns = async (req, res, next) => {
  try {
    const { page, limit, search, status, type } = req.validated.query;
    const filter = buildWorkspaceFilter(req.emailMarketing, {
      ...(search
        ? {
            $or: [
              { name: new RegExp(escapeRegex(search), 'i') },
              { subject: new RegExp(escapeRegex(search), 'i') },
            ],
          }
        : {}),
      ...(status !== 'all' ? { status } : {}),
      ...(type !== 'all' ? { type } : {}),
    });
    const [items, total] = await Promise.all([
      EmailMarketingCampaign.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EmailMarketingCampaign.countDocuments(filter),
    ]);
    return successResponse(res, 200, 'Campaigns fetched successfully', {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getCampaign = async (req, res, next) => {
  try {
    const campaign = await EmailMarketingCampaign.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    ).lean();
    if (!campaign) return errorResponse(res, 404, 'Campaign not found');
    const [recipientCounts, activity, recentEvents] = await Promise.all([
      EmailMarketingRecipient.aggregate([
        {
          $match: {
            workspaceId: req.emailMarketing.workspaceId,
            campaignId: campaign._id,
          },
        },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      EmailMarketingAuditLog.find({
        workspaceId: req.emailMarketing.workspaceId,
        resourceType: 'campaign',
        resourceId: campaign._id,
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      EmailMarketingEvent.find({
        workspaceId: req.emailMarketing.workspaceId,
        campaignId: campaign._id,
      })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean(),
    ]);
    return successResponse(res, 200, 'Campaign fetched successfully', {
      ...campaign,
      recipientCounts: Object.fromEntries(
        recipientCounts.map((entry) => [entry._id, entry.count]),
      ),
      activity,
      recentEvents,
    });
  } catch (error) {
    return next(error);
  }
};

export const createCampaign = async (req, res, next) => {
  try {
    const payload = normalizeCampaignPayload(req.validated.body);
    await validateCampaignDefinition(req.emailMarketing, payload);
    const campaign = await EmailMarketingCampaign.create({
      ...payload,
      status: 'draft',
      workspaceId: req.emailMarketing.workspaceId,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    await recordEmailMarketingAudit({
      req,
      action: 'campaign.created',
      resourceType: 'campaign',
      resourceId: campaign._id,
      metadata: { type: campaign.type },
    });
    return successResponse(res, 201, 'Campaign created successfully', campaign);
  } catch (error) {
    return next(error);
  }
};

export const updateCampaign = async (req, res, next) => {
  try {
    const campaign = await EmailMarketingCampaign.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    );
    if (!campaign) return errorResponse(res, 404, 'Campaign not found');
    if (!editableStatuses.has(campaign.status)) {
      return errorResponse(res, 409, 'This campaign can no longer be edited');
    }
    const payload = normalizeCampaignPayload({
      ...campaign.toObject(),
      ...req.validated.body,
    });
    await validateCampaignDefinition(req.emailMarketing, payload);
    Object.assign(campaign, normalizeCampaignPayload(req.validated.body));
    campaign.updatedBy = req.user._id;
    await campaign.save();
    await recordEmailMarketingAudit({
      req,
      action: 'campaign.updated',
      resourceType: 'campaign',
      resourceId: campaign._id,
      metadata: { fields: Object.keys(req.validated.body) },
    });
    return successResponse(res, 200, 'Campaign updated successfully', campaign);
  } catch (error) {
    return next(error);
  }
};

export const duplicateCampaign = async (req, res, next) => {
  try {
    const source = await EmailMarketingCampaign.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    ).lean();
    if (!source) return errorResponse(res, 404, 'Campaign not found');
    const {
      _id,
      createdAt,
      updatedAt,
      status,
      scheduledAt,
      metrics,
      processing,
      processingStartedAt,
      lastError,
      lastSentAt,
      recurrenceRunCount,
      currentDripStep,
      ...copy
    } = source;
    const campaign = await EmailMarketingCampaign.create({
      ...copy,
      name: `${source.name} Copy ${Date.now().toString().slice(-6)}`,
      status: 'draft',
      scheduledAt: null,
      metrics: {},
      processing: false,
      recurrenceRunCount: 0,
      currentDripStep: 0,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    await recordEmailMarketingAudit({
      req,
      action: 'campaign.duplicated',
      resourceType: 'campaign',
      resourceId: campaign._id,
      metadata: { sourceId: _id },
    });
    return successResponse(res, 201, 'Campaign duplicated successfully', campaign);
  } catch (error) {
    return next(error);
  }
};

const queueCampaign = async ({ req, campaign, runAt, status }) => {
  await validateCampaignDefinition(req.emailMarketing, campaign.toObject());
  const sender = await resolveEmailMarketingSender(req.emailMarketing, {
    requestedFromName: campaign.fromName,
    requestedFromEmail: campaign.fromEmail,
    requestedReplyTo: campaign.replyTo,
  });
  campaign.fromName = sender.fromName;
  campaign.fromEmail = sender.fromEmail;
  campaign.replyTo = sender.replyTo;
  const stepIndex = campaign.type === 'drip_campaign' ? campaign.currentDripStep : -1;
  const actualRunAt =
    campaign.type === 'drip_campaign' && stepIndex === 0
      ? new Date(
          new Date(runAt).getTime() +
            calculateDelayMs(
              campaign.dripSteps[0].delayValue,
              campaign.dripSteps[0].delayUnit,
            ),
        )
      : new Date(runAt);
  await scheduleCampaignDelivery({
    campaignId: campaign._id,
    workspaceId: campaign.workspaceId,
    runAt: actualRunAt,
    runNumber: Math.max(1, campaign.recurrenceRunCount + 1),
    stepIndex,
  });
  campaign.status = status;
  campaign.scheduledAt = actualRunAt;
  campaign.processing = false;
  campaign.lastError = '';
  campaign.updatedBy = req.user._id;
  await campaign.save();
  return campaign;
};

export const scheduleCampaign = async (req, res, next) => {
  try {
    const campaign = await EmailMarketingCampaign.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    );
    if (!campaign) return errorResponse(res, 404, 'Campaign not found');
    if (!editableStatuses.has(campaign.status)) {
      return errorResponse(res, 409, 'Campaign cannot be scheduled from its current status');
    }
    const runAt = new Date(req.validated.body.scheduledAt);
    if (runAt.getTime() < Date.now() - 30000) {
      return errorResponse(res, 400, 'Scheduled time must be in the future');
    }
    campaign.timezone = req.validated.body.timezone;
    await queueCampaign({
      req,
      campaign,
      runAt,
      status: campaign.type === 'drip_campaign' ? 'active' : 'scheduled',
    });
    await recordEmailMarketingAudit({
      req,
      action: 'campaign.scheduled',
      resourceType: 'campaign',
      resourceId: campaign._id,
      metadata: { scheduledAt: campaign.scheduledAt },
    });
    return successResponse(res, 200, 'Campaign scheduled successfully', campaign);
  } catch (error) {
    return next(error);
  }
};

export const sendCampaignNow = async (req, res, next) => {
  try {
    const campaign = await EmailMarketingCampaign.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    );
    if (!campaign) return errorResponse(res, 404, 'Campaign not found');
    if (!editableStatuses.has(campaign.status)) {
      return errorResponse(res, 409, 'Campaign cannot be sent from its current status');
    }
    await queueCampaign({
      req,
      campaign,
      runAt: new Date(),
      status: campaign.type === 'drip_campaign' ? 'active' : 'scheduled',
    });
    await recordEmailMarketingAudit({
      req,
      action: 'campaign.queued',
      resourceType: 'campaign',
      resourceId: campaign._id,
    });
    return successResponse(res, 202, 'Campaign queued successfully', campaign);
  } catch (error) {
    return next(error);
  }
};

export const pauseCampaign = async (req, res, next) => {
  try {
    const campaign = await EmailMarketingCampaign.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    );
    if (!campaign) return errorResponse(res, 404, 'Campaign not found');
    if (!['scheduled', 'active'].includes(campaign.status)) {
      return errorResponse(res, 409, 'Only scheduled or active campaigns can be paused');
    }
    if (campaign.processing) {
      return errorResponse(res, 409, 'Wait for the current delivery batch to finish');
    }
    await cancelCampaignDelivery(campaign);
    campaign.status = 'paused';
    campaign.processing = false;
    campaign.updatedBy = req.user._id;
    await campaign.save();
    await recordEmailMarketingAudit({
      req,
      action: 'campaign.paused',
      resourceType: 'campaign',
      resourceId: campaign._id,
    });
    return successResponse(res, 200, 'Campaign paused successfully', campaign);
  } catch (error) {
    return next(error);
  }
};

export const resumeCampaign = async (req, res, next) => {
  try {
    const campaign = await EmailMarketingCampaign.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    );
    if (!campaign) return errorResponse(res, 404, 'Campaign not found');
    if (campaign.processing) {
      return errorResponse(res, 409, 'Wait for the current delivery batch to finish');
    }
    if (campaign.status !== 'paused') {
      return errorResponse(res, 409, 'Only paused campaigns can be resumed');
    }
    await queueCampaign({
      req,
      campaign,
      runAt: new Date(),
      status: campaign.type === 'drip_campaign' ? 'active' : 'scheduled',
    });
    await recordEmailMarketingAudit({
      req,
      action: 'campaign.resumed',
      resourceType: 'campaign',
      resourceId: campaign._id,
    });
    return successResponse(res, 200, 'Campaign resumed successfully', campaign);
  } catch (error) {
    return next(error);
  }
};

export const archiveCampaign = async (req, res, next) => {
  try {
    const campaign = await EmailMarketingCampaign.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    );
    if (!campaign) return errorResponse(res, 404, 'Campaign not found');
    if (campaign.processing) {
      return errorResponse(res, 409, 'Wait for the current delivery batch to finish');
    }
    await cancelCampaignDelivery(campaign);
    campaign.status = 'archived';
    campaign.processing = false;
    campaign.updatedBy = req.user._id;
    await campaign.save();
    return successResponse(res, 200, 'Campaign archived successfully', campaign);
  } catch (error) {
    return next(error);
  }
};

export const deleteCampaign = async (req, res, next) => {
  try {
    const campaign = await EmailMarketingCampaign.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    );
    if (!campaign) return errorResponse(res, 404, 'Campaign not found');
    if (!['draft', 'archived', 'failed'].includes(campaign.status)) {
      return errorResponse(res, 409, 'Pause or archive this campaign before deleting it');
    }
    await cancelCampaignDelivery(campaign);
    await Promise.all([
      EmailMarketingRecipient.deleteMany({
        workspaceId: req.emailMarketing.workspaceId,
        campaignId: campaign._id,
      }),
      EmailMarketingEvent.deleteMany({
        workspaceId: req.emailMarketing.workspaceId,
        campaignId: campaign._id,
      }),
      campaign.deleteOne(),
    ]);
    return successResponse(res, 200, 'Campaign deleted successfully', null);
  } catch (error) {
    return next(error);
  }
};

export const getCampaignMeta = async (_req, res) =>
  successResponse(res, 200, 'Campaign metadata fetched successfully', {
    types: campaignTypes,
    goals: campaignGoals,
    statuses: campaignStatuses,
    audienceModes: ['all', 'segment', 'selected'],
    recurrenceUnits: ['day', 'week', 'month'],
    dripDelayUnits: ['minutes', 'hours', 'days', 'weeks'],
  });
