import { successResponse } from '../../../utils/response.js';
import EmailMarketingAutomationExecution from '../models/EmailMarketingAutomationExecution.js';
import EmailMarketingCampaign from '../models/EmailMarketingCampaign.js';
import EmailMarketingEvent from '../models/EmailMarketingEvent.js';
import EmailMarketingSubscriber from '../models/EmailMarketingSubscriber.js';
import { rowsToCsv } from '../utils/csvExport.js';
import { resolveDateRange } from '../utils/dateRange.js';

const campaignRows = async (workspaceId, start, end) => {
  const campaigns = await EmailMarketingCampaign.find({
    workspaceId,
    createdAt: { $lte: end },
    updatedAt: { $gte: start },
  })
    .sort({ updatedAt: -1 })
    .limit(10000)
    .lean();
  return campaigns.map((campaign) => ({
    campaignId: String(campaign._id),
    name: campaign.name,
    type: campaign.type,
    status: campaign.status,
    sent: campaign.metrics?.sent || 0,
    delivered: campaign.metrics?.delivered || 0,
    opens: campaign.metrics?.opens || 0,
    uniqueOpens: campaign.metrics?.uniqueOpens || 0,
    clicks: campaign.metrics?.clicks || 0,
    uniqueClicks: campaign.metrics?.uniqueClicks || 0,
    bounces: campaign.metrics?.bounces || 0,
    complaints: campaign.metrics?.complaints || 0,
    unsubscribes: campaign.metrics?.unsubscribes || 0,
    lastSentAt: campaign.lastSentAt || '',
  }));
};

const audienceRows = async (workspaceId, start, end) => {
  const subscribers = await EmailMarketingSubscriber.find({
    workspaceId,
    createdAt: { $gte: start, $lte: end },
  })
    .sort({ createdAt: -1 })
    .limit(10000)
    .lean();
  return subscribers.map((subscriber) => ({
    subscriberId: String(subscriber._id),
    email: subscriber.email,
    firstName: subscriber.firstName,
    lastName: subscriber.lastName,
    status: subscriber.status,
    source: subscriber.source,
    tags: subscriber.tags.join('|'),
    blocked: subscriber.blocked,
    createdAt: subscriber.createdAt,
  }));
};

const deliverabilityRows = async (workspaceId, start, end) => {
  const events = await EmailMarketingEvent.find({
    workspaceId,
    timestamp: { $gte: start, $lte: end },
    eventType: { $in: ['delivery', 'bounce', 'complaint', 'reject'] },
  })
    .select('campaignId recipientEmail messageId eventType timestamp')
    .sort({ timestamp: -1 })
    .limit(10000)
    .lean();
  return events.map((event) => ({
    eventId: String(event._id),
    campaignId: String(event.campaignId),
    recipientEmail: event.recipientEmail,
    messageId: event.messageId,
    eventType: event.eventType,
    timestamp: event.timestamp,
  }));
};

const automationRows = async (workspaceId, start, end) => {
  const executions = await EmailMarketingAutomationExecution.find({
    workspaceId,
    createdAt: { $gte: start, $lte: end },
  })
    .populate('automationId', 'name trigger')
    .sort({ createdAt: -1 })
    .limit(10000)
    .lean();
  return executions.map((execution) => ({
    executionId: String(execution._id),
    automationId: String(execution.automationId?._id || execution.automationId),
    automationName: execution.automationId?.name || '',
    trigger: execution.trigger,
    subscriberEmail: execution.subscriberEmail,
    status: execution.status,
    currentStep: execution.currentStep,
    emailsSent: execution.emailsSent,
    startedAt: execution.startedAt || '',
    completedAt: execution.completedAt || '',
    error: execution.lastError,
  }));
};

const builders = {
  campaigns: campaignRows,
  audience: audienceRows,
  deliverability: deliverabilityRows,
  automations: automationRows,
};

export const exportReport = async (req, res, next) => {
  try {
    const { target, format } = req.validated.query;
    const { start, end } = resolveDateRange(req.validated.query);
    const rows = await builders[target](
      req.emailMarketing.workspaceId,
      start,
      end,
    );
    if (format === 'csv') {
      const filename = `email-marketing-${target}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      });
      return res.send(`\uFEFF${rowsToCsv(rows)}`);
    }
    return successResponse(res, 200, 'Email Marketing report generated', {
      target,
      range: { from: start, to: end },
      count: rows.length,
      rows,
    });
  } catch (error) {
    return next(error);
  }
};
