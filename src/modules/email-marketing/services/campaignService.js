import EmailMarketingSegment from '../models/EmailMarketingSegment.js';
import EmailMarketingSubscriber from '../models/EmailMarketingSubscriber.js';
import EmailMarketingSuppression from '../models/EmailMarketingSuppression.js';
import EmailMarketingTemplate from '../models/EmailMarketingTemplate.js';
import { buildSegmentFilter } from '../utils/segmentFilter.js';
import { buildWorkspaceFilter } from './workspaceService.js';

const httpError = (statusCode, message) =>
  Object.assign(new Error(message), { statusCode });

export const normalizeCampaignPayload = (payload) => {
  const normalized = { ...payload };
  if (Object.hasOwn(payload, 'templateId')) {
    normalized.templateId = payload.templateId || null;
  }
  if (Object.hasOwn(payload, 'segmentId')) {
    normalized.segmentId = payload.segmentId || null;
  }
  if (Object.hasOwn(payload, 'recurrenceEndAt')) {
    normalized.recurrenceEndAt = payload.recurrenceEndAt
      ? new Date(payload.recurrenceEndAt)
      : null;
  }
  return normalized;
};

export const validateCampaignDefinition = async (
  emailMarketingContext,
  payload,
) => {
  if (payload.type === 'drip_campaign') {
    if (!payload.dripSteps?.length) {
      throw httpError(400, 'Drip campaigns require at least one email step');
    }
  } else if (!payload.templateId || !payload.subject?.trim()) {
    throw httpError(400, 'Campaign subject and template are required');
  }

  if (payload.audienceMode === 'segment' && !payload.segmentId) {
    throw httpError(400, 'Select a segment for this campaign');
  }
  if (
    payload.audienceMode === 'selected' &&
    !payload.subscriberIds?.length
  ) {
    throw httpError(400, 'Select at least one subscriber');
  }

  const templateIds =
    payload.type === 'drip_campaign'
      ? payload.dripSteps.map((step) => step.templateId)
      : [payload.templateId];
  const templateCount = await EmailMarketingTemplate.countDocuments(
    buildWorkspaceFilter(emailMarketingContext, {
      _id: { $in: templateIds },
      status: { $ne: 'archived' },
    }),
  );
  if (templateCount !== new Set(templateIds.map(String)).size) {
    throw httpError(400, 'One or more campaign templates are unavailable');
  }

  if (payload.audienceMode === 'segment') {
    const segmentExists = await EmailMarketingSegment.exists(
      buildWorkspaceFilter(emailMarketingContext, { _id: payload.segmentId }),
    );
    if (!segmentExists) throw httpError(400, 'Selected segment was not found');
  }
  if (payload.audienceMode === 'selected') {
    const selectedCount = await EmailMarketingSubscriber.countDocuments(
      buildWorkspaceFilter(emailMarketingContext, {
        _id: { $in: payload.subscriberIds },
      }),
    );
    if (selectedCount !== new Set(payload.subscriberIds.map(String)).size) {
      throw httpError(400, 'One or more selected subscribers were not found');
    }
  }
  return true;
};

export const resolveCampaignAudience = async (campaign) => {
  const context = { workspaceId: campaign.workspaceId };
  let filter = buildWorkspaceFilter(context, {
    status: 'subscribed',
    blocked: false,
  });
  if (campaign.audienceMode === 'segment') {
    const segment = await EmailMarketingSegment.findOne(
      buildWorkspaceFilter(context, { _id: campaign.segmentId }),
    ).lean();
    if (!segment) throw httpError(400, 'Campaign segment was not found');
    filter = {
      ...buildSegmentFilter(context, segment),
      status: 'subscribed',
      blocked: false,
    };
  } else if (campaign.audienceMode === 'selected') {
    filter._id = { $in: campaign.subscriberIds };
  }
  if (
    campaign.type === 'drip_campaign' &&
    campaign.dripTargetAudience === 'new_only'
  ) {
    filter.createdAt = { $gte: campaign.createdAt };
  }

  const subscribers = await EmailMarketingSubscriber.find(filter).lean();
  const suppressions = await EmailMarketingSuppression.find(
    buildWorkspaceFilter(context, {
      email: { $in: subscribers.map((subscriber) => subscriber.email) },
      status: 'active',
    }),
  )
    .select('email')
    .lean();
  const blocked = new Set(suppressions.map((entry) => entry.email));
  return subscribers.filter((subscriber) => !blocked.has(subscriber.email));
};
