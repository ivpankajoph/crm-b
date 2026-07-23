import EmailMarketingCampaign from '../models/EmailMarketingCampaign.js';
import EmailMarketingEvent from '../models/EmailMarketingEvent.js';
import EmailMarketingRecipient from '../models/EmailMarketingRecipient.js';
import EmailMarketingTemplate from '../models/EmailMarketingTemplate.js';
import { resolveCampaignAudience } from './campaignService.js';
import { resolveEmailMarketingSender } from './senderService.js';
import { renderCampaignEmail } from './emailRenderService.js';
import { sendSesEmail } from './sesService.js';
import { calculateDelayMs, nextRecurrenceDate } from '../utils/campaign.js';
import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import { debitEmailCredits, refundEmailCredits } from './billingService.js';

const parallelLimit = async (items, limit, handler) => {
  const executing = new Set();
  const results = [];
  for (const item of items) {
    const promise = Promise.resolve()
      .then(() => handler(item))
      .finally(() => executing.delete(promise));
    executing.add(promise);
    results.push(promise);
    if (executing.size >= limit) await Promise.race(executing);
  }
  return Promise.all(results);
};

const sendToSubscriber = async ({
  campaign,
  subscriber,
  template,
  subject,
  runNumber,
  stepIndex,
}) => {
  const recipient = await EmailMarketingRecipient.findOneAndUpdate(
    {
      workspaceId: campaign.workspaceId,
      campaignId: campaign._id,
      subscriberId: subscriber._id,
      runNumber,
      stepIndex,
    },
    {
      $setOnInsert: {
        workspaceId: campaign.workspaceId,
        campaignId: campaign._id,
        subscriberId: subscriber._id,
        email: subscriber.email,
        runNumber,
        stepIndex,
        status: 'queued',
        createdBy: campaign.updatedBy,
        updatedBy: campaign.updatedBy,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  if (['sent', 'delivered', 'opened', 'clicked'].includes(recipient.status)) {
    return { status: 'skipped' };
  }

  let debit = null;
  let sesAccepted = false;
  try {
    const rendered = renderCampaignEmail({
      campaign,
      template,
      subscriber,
      recipientId: recipient._id,
      subject,
    });
    debit = await debitEmailCredits({
      workspaceId: campaign.workspaceId,
      actorUserId: campaign.updatedBy,
      credits: 1,
      type: 'campaign_send',
      sourceType: 'campaign',
      sourceId: campaign._id,
      idempotencyKey: `campaign:${campaign._id}:${recipient._id}`,
      description: `Campaign email: ${campaign.name}`,
    });
    const response = await sendSesEmail({
      fromName: campaign.fromName,
      fromEmail: campaign.fromEmail,
      replyTo: campaign.replyTo,
      recipient: subscriber.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      unsubscribeUrl: rendered.unsubscribeUrl,
      tags: {
        workspaceId: campaign.workspaceId,
        campaignId: campaign._id,
        recipientId: recipient._id,
      },
    });
    sesAccepted = true;
    const now = new Date();
    recipient.messageId = response.MessageId;
    recipient.status = 'sent';
    recipient.sentAt = now;
    recipient.failedAt = null;
    recipient.lastError = '';
    recipient.updatedBy = campaign.updatedBy;
    await recipient.save();
    await EmailMarketingEvent.create({
      workspaceId: campaign.workspaceId,
      campaignId: campaign._id,
      recipientId: recipient._id,
      subscriberId: subscriber._id,
      recipientEmail: subscriber.email,
      messageId: response.MessageId,
      providerEventId: `send:${response.MessageId}`,
      eventType: 'send',
      timestamp: now,
      createdBy: campaign.updatedBy,
      updatedBy: campaign.updatedBy,
    }).catch((error) => {
      if (error.code !== 11000) throw error;
    });
    return { status: 'sent' };
  } catch (error) {
    if (!sesAccepted) {
      await refundEmailCredits({
        debit,
        actorUserId: campaign.updatedBy,
        description: `Refund for failed campaign email: ${campaign.name}`,
      });
    }
    recipient.status = 'failed';
    recipient.failedAt = new Date();
    recipient.lastError = error.message;
    recipient.updatedBy = campaign.updatedBy;
    await recipient.save();
    return { status: 'failed', error: error.message };
  }
};

export const dispatchCampaignJob = async ({
  campaignId,
  workspaceId,
  stepIndex = -1,
  runNumber,
}) => {
  const staleProcessingBefore = new Date(Date.now() - 30 * 60 * 1000);
  const campaign = await EmailMarketingCampaign.findOneAndUpdate(
    {
      _id: campaignId,
      workspaceId,
      status: { $in: ['scheduled', 'active', 'sending'] },
      $or: [
        { processing: { $ne: true } },
        { processingStartedAt: { $lt: staleProcessingBefore } },
      ],
    },
    {
      $set: {
        processing: true,
        processingStartedAt: new Date(),
        ...(stepIndex < 0 ? { status: 'sending' } : {}),
      },
    },
    { new: true },
  );
  if (!campaign) return null;

  try {
    const sender = await resolveEmailMarketingSender(
      { workspaceId: campaign.workspaceId },
      {
        requestedFromName: campaign.fromName,
        requestedFromEmail: campaign.fromEmail,
        requestedReplyTo: campaign.replyTo,
      },
    );
    campaign.fromName = sender.fromName;
    campaign.fromEmail = sender.fromEmail;
    campaign.replyTo = sender.replyTo;
    const dripStep =
      campaign.type === 'drip_campaign' ? campaign.dripSteps[stepIndex] : null;
    if (campaign.type === 'drip_campaign' && !dripStep) {
      campaign.status = 'sent';
      campaign.processing = false;
      await campaign.save();
      return null;
    }
    const templateId = dripStep?.templateId || campaign.templateId;
    const subject = dripStep?.subject || campaign.subject;
    const template = await EmailMarketingTemplate.findOne({
      _id: templateId,
      workspaceId: campaign.workspaceId,
      status: { $ne: 'archived' },
    }).lean();
    if (!template) throw new Error('Campaign template is unavailable');

    const subscribers = await resolveCampaignAudience(campaign);
    const activeRun =
      runNumber || Math.max(1, Number(campaign.recurrenceRunCount || 0) + 1);
    const results = await parallelLimit(
      subscribers,
      getEmailMarketingConfig().sendConcurrency,
      (subscriber) =>
        sendToSubscriber({
          campaign,
          subscriber,
          template,
          subject,
          runNumber: activeRun,
          stepIndex,
        }),
    );
    const sent = results.filter((result) => result.status === 'sent').length;
    const failed = results.filter((result) => result.status === 'failed').length;
    campaign.totalRecipients = subscribers.length;
    campaign.metrics.sent += sent;
    campaign.lastSentAt = sent ? new Date() : campaign.lastSentAt;
    campaign.processing = false;
    campaign.processingStartedAt = null;
    campaign.lastError =
      failed && !sent ? results.find((result) => result.error)?.error || '' : '';

    if (campaign.type === 'drip_campaign') {
      const nextStepIndex = stepIndex + 1;
      campaign.currentDripStep = nextStepIndex;
      if (nextStepIndex < campaign.dripSteps.length) {
        const nextStep = campaign.dripSteps[nextStepIndex];
        const nextRunAt = new Date(
          Date.now() + calculateDelayMs(nextStep.delayValue, nextStep.delayUnit),
        );
        campaign.status = 'active';
        campaign.scheduledAt = nextRunAt;
        await campaign.save();
        return { nextRunAt, nextStepIndex, runNumber: activeRun };
      }
      campaign.status = sent || subscribers.length === 0 ? 'sent' : 'failed';
      campaign.scheduledAt = null;
      await campaign.save();
      return null;
    }

    campaign.recurrenceRunCount = activeRun;
    const nextRunAt = nextRecurrenceDate(campaign, new Date());
    if (nextRunAt) {
      campaign.status = 'scheduled';
      campaign.scheduledAt = nextRunAt;
      await campaign.save();
      return { nextRunAt, nextStepIndex: -1, runNumber: activeRun + 1 };
    }
    campaign.status = sent || subscribers.length === 0 ? 'sent' : 'failed';
    campaign.scheduledAt = null;
    await campaign.save();
    return null;
  } catch (error) {
    campaign.processing = false;
    campaign.processingStartedAt = null;
    campaign.lastError = error.message;
    await campaign.save();
    throw error;
  }
};
