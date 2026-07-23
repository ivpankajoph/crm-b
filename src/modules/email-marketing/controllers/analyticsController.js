import { successResponse } from '../../../utils/response.js';
import EmailMarketingAutomation from '../models/EmailMarketingAutomation.js';
import EmailMarketingAutomationExecution from '../models/EmailMarketingAutomationExecution.js';
import EmailMarketingCampaign from '../models/EmailMarketingCampaign.js';
import EmailMarketingDomain from '../models/EmailMarketingDomain.js';
import EmailMarketingEvent from '../models/EmailMarketingEvent.js';
import EmailMarketingSubscriber from '../models/EmailMarketingSubscriber.js';
import EmailMarketingSuppression from '../models/EmailMarketingSuppression.js';
import { resolveDateRange } from '../utils/dateRange.js';

const eventTotals = (rows) =>
  Object.fromEntries(rows.map((row) => [row._id, row.count]));

export const getAnalyticsOverview = async (req, res, next) => {
  try {
    const { start, end } = resolveDateRange(req.validated.query);
    const workspaceId = req.emailMarketing.workspaceId;
    const [events, uniqueEngagement, campaigns, subscribers, automations, recentEvents] =
      await Promise.all([
        EmailMarketingEvent.aggregate([
          {
            $match: {
              workspaceId,
              timestamp: { $gte: start, $lte: end },
            },
          },
          { $group: { _id: '$eventType', count: { $sum: 1 } } },
        ]),
        EmailMarketingEvent.aggregate([
          {
            $match: {
              workspaceId,
              timestamp: { $gte: start, $lte: end },
              eventType: { $in: ['open', 'click'] },
            },
          },
          {
            $group: {
              _id: {
                eventType: '$eventType',
                recipientId: '$recipientId',
              },
            },
          },
          { $group: { _id: '$_id.eventType', count: { $sum: 1 } } },
        ]),
        EmailMarketingCampaign.find({
          workspaceId,
          createdAt: { $lte: end },
        })
          .select('name status type metrics totalRecipients lastSentAt createdAt updatedAt')
          .sort({ 'metrics.sent': -1 })
          .lean(),
        EmailMarketingSubscriber.aggregate([
          { $match: { workspaceId } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        EmailMarketingAutomation.find({ workspaceId })
          .select('name status trigger executionCount completedCount failedCount emailsSent lastRunAt')
          .sort({ executionCount: -1 })
          .lean(),
        EmailMarketingEvent.find({
          workspaceId,
          timestamp: { $gte: start, $lte: end },
          recipientEmail: { $ne: '' },
          eventType: {
            $in: [
              'send',
              'delivery',
              'open',
              'click',
              'bounce',
              'complaint',
              'reject',
              'unsubscribe',
              'failed',
            ],
          },
        })
          .select('campaignId recipientEmail eventType timestamp')
          .populate('campaignId', 'name')
          .sort({ timestamp: -1 })
          .limit(50)
          .lean(),
      ]);
    const totals = eventTotals(events);
    const unique = eventTotals(uniqueEngagement);
    const sent = totals.send || 0;
    const delivered = totals.delivery || 0;
    return successResponse(res, 200, 'Email analytics fetched successfully', {
      range: { from: start, to: end },
      totals: {
        sent,
        delivered,
        opens: totals.open || 0,
        uniqueOpens: unique.open || 0,
        clicks: totals.click || 0,
        uniqueClicks: unique.click || 0,
        bounces: totals.bounce || 0,
        complaints: totals.complaint || 0,
        unsubscribes: totals.unsubscribe || 0,
      },
      rates: {
        deliveryRate: sent ? (delivered / sent) * 100 : 0,
        openRate: delivered ? ((unique.open || 0) / delivered) * 100 : 0,
        clickRate: delivered ? ((unique.click || 0) / delivered) * 100 : 0,
        bounceRate: sent ? ((totals.bounce || 0) / sent) * 100 : 0,
        complaintRate: sent ? ((totals.complaint || 0) / sent) * 100 : 0,
      },
      audience: eventTotals(subscribers),
      campaigns,
      automations,
      recentEvents: recentEvents.map((event) => ({
        _id: event._id,
        campaignId: String(event.campaignId?._id || event.campaignId),
        campaignName: event.campaignId?.name || '',
        recipientEmail: event.recipientEmail,
        eventType: event.eventType,
        timestamp: event.timestamp,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

export const getAnalyticsTimeseries = async (req, res, next) => {
  try {
    const { start, end } = resolveDateRange(req.validated.query);
    const items = await EmailMarketingEvent.aggregate([
      {
        $match: {
          workspaceId: req.emailMarketing.workspaceId,
          timestamp: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            eventType: '$eventType',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
      {
        $group: {
          _id: '$_id.date',
          events: {
            $push: { type: '$_id.eventType', count: '$count' },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return successResponse(res, 200, 'Analytics timeseries fetched successfully', {
      items: items.map((item) => ({
        date: item._id,
        ...Object.fromEntries(
          item.events.map((event) => [event.type, event.count]),
        ),
      })),
    });
  } catch (error) {
    return next(error);
  }
};

export const getDeliverability = async (req, res, next) => {
  try {
    const { start, end } = resolveDateRange(req.validated.query);
    const workspaceId = req.emailMarketing.workspaceId;
    const [events, domains, suppressionCounts, recentFailures] =
      await Promise.all([
        EmailMarketingEvent.aggregate([
          {
            $match: {
              workspaceId,
              timestamp: { $gte: start, $lte: end },
              eventType: {
                $in: ['send', 'delivery', 'bounce', 'complaint', 'reject'],
              },
            },
          },
          { $group: { _id: '$eventType', count: { $sum: 1 } } },
        ]),
        EmailMarketingDomain.find({ workspaceId })
          .select('domain status health providerStatus dkimStatus mailFromStatus lastCheckedAt')
          .sort({ domain: 1 })
          .lean(),
        EmailMarketingSuppression.aggregate([
          { $match: { workspaceId, status: 'active' } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ]),
        EmailMarketingEvent.find({
          workspaceId,
          timestamp: { $gte: start, $lte: end },
          eventType: { $in: ['bounce', 'complaint', 'reject'] },
        })
          .select('recipientEmail eventType timestamp messageId')
          .sort({ timestamp: -1 })
          .limit(100)
          .lean(),
      ]);
    const totals = eventTotals(events);
    const sent = totals.send || 0;
    return successResponse(res, 200, 'Deliverability metrics fetched successfully', {
      range: { from: start, to: end },
      totals,
      rates: {
        deliveryRate: sent ? ((totals.delivery || 0) / sent) * 100 : 0,
        bounceRate: sent ? ((totals.bounce || 0) / sent) * 100 : 0,
        complaintRate: sent ? ((totals.complaint || 0) / sent) * 100 : 0,
        rejectionRate: sent ? ((totals.reject || 0) / sent) * 100 : 0,
      },
      suppressions: eventTotals(suppressionCounts),
      domains,
      recentFailures,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAutomationAnalytics = async (req, res, next) => {
  try {
    const { start, end } = resolveDateRange(req.validated.query);
    const rows = await EmailMarketingAutomationExecution.aggregate([
      {
        $match: {
          workspaceId: req.emailMarketing.workspaceId,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { automationId: '$automationId', status: '$status' },
          count: { $sum: 1 },
          emailsSent: { $sum: '$emailsSent' },
        },
      },
      {
        $group: {
          _id: '$_id.automationId',
          executions: {
            $push: { status: '$_id.status', count: '$count' },
          },
          emailsSent: { $sum: '$emailsSent' },
          total: { $sum: '$count' },
        },
      },
    ]);
    const automations = await EmailMarketingAutomation.find({
      workspaceId: req.emailMarketing.workspaceId,
      _id: { $in: rows.map((row) => row._id) },
    })
      .select('name trigger status')
      .lean();
    const names = new Map(
      automations.map((automation) => [String(automation._id), automation]),
    );
    return successResponse(res, 200, 'Automation analytics fetched successfully', {
      items: rows.map((row) => ({
        automation: names.get(String(row._id)) || { _id: row._id },
        total: row.total,
        emailsSent: row.emailsSent,
        executions: Object.fromEntries(
          row.executions.map((entry) => [entry.status, entry.count]),
        ),
      })),
    });
  } catch (error) {
    return next(error);
  }
};
