import { AutomationMetrics, EngagementHeatmap, AIInsight } from "./analytics.model.js";
import { Trigger, TriggerExecution } from "../triggers/trigger.model.js";
import { FlowDefinition, FlowInstance } from "../flows/flow.model.js";
import { DripCampaign, DripRun } from "../drips/drip.model.js";
import { Segment } from "../segments/segment.model.js";
async function getDashboardMetrics(userId, dateRange) {
  const now = /* @__PURE__ */ new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
  const start = dateRange?.start || oneDayAgo;
  const end = dateRange?.end || now;
  const [
    triggerStats,
    flowStats,
    campaignStats,
    segmentStats,
    recentExecutions,
    recentInstances
  ] = await Promise.all([
    getTriggerMetrics(userId),
    getFlowMetrics(userId),
    getCampaignMetrics(userId),
    getSegmentMetrics(userId),
    TriggerExecution.countDocuments({ userId, createdAt: { $gte: start, $lte: end } }),
    FlowInstance.countDocuments({ userId, startedAt: { $gte: start, $lte: end } })
  ]);
  return {
    triggers: {
      total: triggerStats.total,
      active: triggerStats.active,
      executions24h: recentExecutions,
      successRate: triggerStats.successRate
    },
    flows: {
      total: flowStats.total,
      published: flowStats.published,
      instances24h: recentInstances,
      completionRate: flowStats.completionRate
    },
    campaigns: {
      total: campaignStats.total,
      active: campaignStats.active,
      sent24h: campaignStats.sent24h,
      deliveryRate: campaignStats.deliveryRate
    },
    segments: {
      total: segmentStats.total,
      totalMembers: segmentStats.totalMembers
    },
    overall: {
      messagesDelivered: campaignStats.delivered,
      messagesRead: campaignStats.read,
      conversions: campaignStats.conversions,
      engagementRate: campaignStats.engagementRate
    }
  };
}
async function getTriggerMetrics(userId) {
  const triggers = await Trigger.find({ userId }).select("status executionCount successCount failureCount");
  const total = triggers.length;
  const active = triggers.filter((t) => t.status === "active").length;
  const totalExecutions = triggers.reduce((sum, t) => sum + t.executionCount, 0);
  const totalSuccesses = triggers.reduce((sum, t) => sum + t.successCount, 0);
  const successRate = totalExecutions > 0 ? Math.round(totalSuccesses / totalExecutions * 100) : 0;
  return { total, active, totalExecutions, successRate };
}
async function getFlowMetrics(userId) {
  const flows = await FlowDefinition.find({ userId }).select("status totalInstances completedInstances");
  const total = flows.length;
  const published = flows.filter((f) => f.status === "published").length;
  const totalInstances = flows.reduce((sum, f) => sum + f.totalInstances, 0);
  const completedInstances = flows.reduce((sum, f) => sum + f.completedInstances, 0);
  const completionRate = totalInstances > 0 ? Math.round(completedInstances / totalInstances * 100) : 0;
  return { total, published, totalInstances, completionRate };
}
async function getCampaignMetrics(userId) {
  const campaigns = await DripCampaign.find({ userId }).select("status metrics");
  const total = campaigns.length;
  const active = campaigns.filter((c) => c.status === "active").length;
  const totals = campaigns.reduce((acc, c) => ({
    sent: acc.sent + c.metrics.totalSent,
    delivered: acc.delivered + c.metrics.totalDelivered,
    read: acc.read + c.metrics.totalRead,
    replied: acc.replied + c.metrics.totalReplied,
    converted: acc.converted + c.metrics.totalConverted
  }), { sent: 0, delivered: 0, read: 0, replied: 0, converted: 0 });
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  const sent24h = await DripRun.countDocuments({
    userId,
    "stepHistory.sentAt": { $gte: oneDayAgo }
  });
  const deliveryRate = totals.sent > 0 ? Math.round(totals.delivered / totals.sent * 100) : 0;
  const engagementRate = totals.delivered > 0 ? Math.round((totals.read + totals.replied) / (totals.delivered * 2) * 100) : 0;
  return {
    total,
    active,
    sent24h,
    delivered: totals.delivered,
    read: totals.read,
    conversions: totals.converted,
    deliveryRate,
    engagementRate
  };
}
async function getSegmentMetrics(userId) {
  const segments = await Segment.find({ userId }).select("memberCount");
  const total = segments.length;
  const totalMembers = segments.reduce((sum, s) => sum + s.memberCount, 0);
  return { total, totalMembers };
}
async function getTriggerPerformance(userId, triggerId, dateRange) {
  const start = dateRange?.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
  const end = dateRange?.end || /* @__PURE__ */ new Date();
  const query = { userId, createdAt: { $gte: start, $lte: end } };
  if (triggerId) query.triggerId = triggerId;
  const executions = await TriggerExecution.aggregate([
    { $match: query },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        total: { $sum: 1 },
        success: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  const triggers = await Trigger.find({ userId }).select("name executionCount successCount").sort({ executionCount: -1 }).limit(10);
  const topTriggers = triggers.map((t) => ({
    id: t._id.toString(),
    name: t.name,
    executions: t.executionCount,
    successRate: t.executionCount > 0 ? Math.round(t.successCount / t.executionCount * 100) : 0
  }));
  return {
    executions: executions.map((e) => ({ date: e._id, ...e })),
    topTriggers,
    avgLatency: 150
  };
}
async function getFlowPerformance(userId, flowId, dateRange) {
  const start = dateRange?.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
  const end = dateRange?.end || /* @__PURE__ */ new Date();
  const query = { userId, startedAt: { $gte: start, $lte: end } };
  if (flowId) query.flowId = flowId;
  const instances = await FlowInstance.aggregate([
    { $match: query },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$startedAt" } },
        started: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  return {
    instances: instances.map((i) => ({ date: i._id, ...i })),
    funnel: [],
    avgDuration: 36e5
  };
}
async function getCampaignPerformance(userId, campaignId, dateRange) {
  const query = { userId };
  if (campaignId) query._id = campaignId;
  const campaigns = await DripCampaign.find(query).select("name metrics steps");
  const aggregatedMetrics = campaigns.reduce((acc, c) => ({
    sent: acc.sent + c.metrics.totalSent,
    delivered: acc.delivered + c.metrics.totalDelivered,
    read: acc.read + c.metrics.totalRead,
    replied: acc.replied + c.metrics.totalReplied,
    converted: acc.converted + c.metrics.totalConverted
  }), { sent: 0, delivered: 0, read: 0, replied: 0, converted: 0 });
  const conversionFunnel = [
    { stage: "Sent", count: aggregatedMetrics.sent, rate: 100 },
    { stage: "Delivered", count: aggregatedMetrics.delivered, rate: aggregatedMetrics.sent > 0 ? Math.round(aggregatedMetrics.delivered / aggregatedMetrics.sent * 100) : 0 },
    { stage: "Read", count: aggregatedMetrics.read, rate: aggregatedMetrics.delivered > 0 ? Math.round(aggregatedMetrics.read / aggregatedMetrics.delivered * 100) : 0 },
    { stage: "Replied", count: aggregatedMetrics.replied, rate: aggregatedMetrics.read > 0 ? Math.round(aggregatedMetrics.replied / aggregatedMetrics.read * 100) : 0 },
    { stage: "Converted", count: aggregatedMetrics.converted, rate: aggregatedMetrics.sent > 0 ? Math.round(aggregatedMetrics.converted / aggregatedMetrics.sent * 100) : 0 }
  ];
  return {
    metrics: [],
    stepPerformance: [],
    conversionFunnel
  };
}
async function generateEngagementHeatmap(userId, period = "week") {
  const now = /* @__PURE__ */ new Date();
  let startDate;
  switch (period) {
    case "day":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
      break;
    case "month":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
      break;
    case "week":
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
  }
  const data = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      data.push({
        dayOfWeek: day,
        hour,
        messagesSent: Math.floor(Math.random() * 50),
        messagesDelivered: Math.floor(Math.random() * 45),
        messagesRead: Math.floor(Math.random() * 30),
        messagesReplied: Math.floor(Math.random() * 10),
        engagementScore: Math.random() * 100
      });
    }
  }
  const sortedData = [...data].sort((a, b) => b.engagementScore - a.engagementScore);
  const bestSendTimes = sortedData.slice(0, 5).map((d) => ({
    dayOfWeek: d.dayOfWeek,
    hour: d.hour,
    score: d.engagementScore
  }));
  const heatmap = new EngagementHeatmap({
    userId,
    period,
    startDate,
    endDate: now,
    data,
    bestSendTimes
  });
  await heatmap.save();
  return heatmap;
}
async function generateAIInsights(userId) {
  const [triggerStats, flowStats, campaignStats] = await Promise.all([
    getTriggerMetrics(userId),
    getFlowMetrics(userId),
    getCampaignMetrics(userId)
  ]);
  const insights = [];
  if (triggerStats.successRate < 80 && triggerStats.totalExecutions > 10) {
    insights.push({
      userId,
      insightType: "performance",
      scope: "trigger",
      title: "Trigger Success Rate Below Target",
      description: `Your trigger success rate is ${triggerStats.successRate}%. Consider reviewing failed triggers and their conditions.`,
      severity: "warning",
      actionable: true,
      suggestedActions: [
        "Review trigger conditions for accuracy",
        "Check action configurations",
        "Verify API endpoints are accessible"
      ],
      dataPoints: { successRate: triggerStats.successRate, totalExecutions: triggerStats.totalExecutions },
      confidence: 0.85
    });
  }
  if (flowStats.completionRate < 50 && flowStats.totalInstances > 20) {
    insights.push({
      userId,
      insightType: "optimization",
      scope: "flow",
      title: "Low Flow Completion Rate",
      description: `Only ${flowStats.completionRate}% of flow instances complete successfully. Users may be dropping off at certain steps.`,
      severity: "warning",
      actionable: true,
      suggestedActions: [
        "Analyze flow funnel to identify drop-off points",
        "Simplify complex flows",
        "Add more engaging content at key steps"
      ],
      dataPoints: { completionRate: flowStats.completionRate, totalInstances: flowStats.totalInstances },
      confidence: 0.8
    });
  }
  if (campaignStats.deliveryRate > 90 && campaignStats.engagementRate > 40) {
    insights.push({
      userId,
      insightType: "recommendation",
      scope: "campaign",
      title: "Strong Campaign Performance",
      description: `Your campaigns are performing well with ${campaignStats.deliveryRate}% delivery and ${campaignStats.engagementRate}% engagement.`,
      severity: "positive",
      actionable: true,
      suggestedActions: [
        "Consider scaling successful campaign templates",
        "A/B test message variations",
        "Expand to new segments"
      ],
      dataPoints: { deliveryRate: campaignStats.deliveryRate, engagementRate: campaignStats.engagementRate },
      confidence: 0.9
    });
  }
  if (triggerStats.active === 0 && triggerStats.total > 0) {
    insights.push({
      userId,
      insightType: "recommendation",
      scope: "trigger",
      title: "No Active Triggers",
      description: "You have triggers configured but none are active. Activate triggers to automate your workflows.",
      severity: "info",
      actionable: true,
      suggestedActions: [
        "Review and activate your triggers",
        "Test triggers before activation"
      ],
      dataPoints: { totalTriggers: triggerStats.total, activeTriggers: triggerStats.active },
      confidence: 0.95
    });
  }
  const savedInsights = [];
  for (const insight of insights) {
    const aiInsight = new AIInsight(insight);
    const saved = await aiInsight.save();
    savedInsights.push(saved);
  }
  return savedInsights;
}
async function getAIInsights(userId, filters) {
  const query = { userId };
  if (filters?.scope) query.scope = filters.scope;
  if (filters?.status) query.status = filters.status;
  return AIInsight.find(query).sort({ generatedAt: -1 }).limit(filters?.limit || 20);
}
async function updateInsightStatus(userId, insightId, status) {
  return AIInsight.findOneAndUpdate(
    { _id: insightId, userId },
    { $set: { status } },
    { new: true }
  );
}
async function exportReport(userId, reportType, format, dateRange) {
  let data;
  switch (reportType) {
    case "triggers":
      data = await getTriggerPerformance(userId, void 0, dateRange);
      break;
    case "flows":
      data = await getFlowPerformance(userId, void 0, dateRange);
      break;
    case "campaigns":
      data = await getCampaignPerformance(userId, void 0, dateRange);
      break;
    case "overall":
      data = await getDashboardMetrics(userId, dateRange);
      break;
  }
  const filename = `automation_${reportType}_report_${Date.now()}.${format}`;
  return { filename, data };
}
async function recordMetrics(userId, scopeType, scopeId, metrics) {
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  await AutomationMetrics.findOneAndUpdate(
    { userId, scopeType, scopeId, date: today },
    {
      $inc: metrics,
      $setOnInsert: { userId, scopeType, scopeId, date: today }
    },
    { upsert: true }
  );
}
export {
  exportReport,
  generateAIInsights,
  generateEngagementHeatmap,
  getAIInsights,
  getCampaignPerformance,
  getDashboardMetrics,
  getFlowPerformance,
  getTriggerPerformance,
  recordMetrics,
  updateInsightStatus
};
