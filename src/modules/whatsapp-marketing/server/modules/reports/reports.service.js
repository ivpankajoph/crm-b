import * as mongodb from "../storage/mongodb.adapter.js";
import { getTenantUsageEvents } from "../usage/usage.service.js";
function getDateRange(filter) {
  const now = /* @__PURE__ */ new Date();
  let startDate;
  let endDate = new Date(now);
  switch (filter.period) {
    case "hour":
      startDate = new Date(now.getTime() - 60 * 60 * 1e3);
      break;
    case "today":
    case "today_hourly":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "yesterday":
    case "yesterday_hourly":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
      break;
    case "month":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
      break;
    case "year":
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1e3);
      break;
    case "custom":
      startDate = filter.startDate ? new Date(filter.startDate) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
      endDate = filter.endDate ? new Date(filter.endDate) : now;
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
  }
  return { startDate, endDate };
}
async function getAIAgentPerformance(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const agents = await mongodb.readCollection("agents");
  const messages = await mongodb.readCollection("messages");
  const contactAgents = await mongodb.readCollection("contact_agents");
  const filteredMessages = messages.filter((m) => {
    const timestamp = new Date(m.timestamp || m.createdAt);
    return timestamp >= startDate && timestamp <= endDate;
  });
  const agentStats = agents.map((agent) => {
    const assignments = contactAgents.filter((ca) => ca.agentId === agent.id);
    const contactIds = assignments.map((a) => a.contactId);
    const agentMessages = filteredMessages.filter(
      (m) => contactIds.includes(m.contactId) && m.direction === "outbound"
    );
    const inboundMessages = filteredMessages.filter(
      (m) => contactIds.includes(m.contactId) && m.direction === "inbound"
    );
    const responseCount = agentMessages.length;
    const uniqueChats = new Set(agentMessages.map((m) => m.contactId)).size;
    const avgResponseTime = calculateAvgResponseTime(inboundMessages, agentMessages);
    return {
      id: agent.id,
      name: agent.name,
      model: agent.model || "gpt-4o",
      chatsHandled: uniqueChats,
      messagesGenerated: responseCount,
      avgResponseTime: formatResponseTime(avgResponseTime),
      avgResponseTimeMs: avgResponseTime,
      isActive: agent.isActive,
      temperature: agent.temperature
    };
  });
  const sortedAgents = agentStats.sort((a, b) => b.chatsHandled - a.chatsHandled);
  const totalChats = sortedAgents.reduce((sum, a) => sum + a.chatsHandled, 0);
  const totalMessages = sortedAgents.reduce((sum, a) => sum + a.messagesGenerated, 0);
  const activeAgents = sortedAgents.filter((a) => a.isActive).length;
  const avgResponseTimes = sortedAgents.filter((a) => a.avgResponseTimeMs > 0).map((a) => a.avgResponseTimeMs);
  const overallAvgResponseTime = avgResponseTimes.length > 0 ? avgResponseTimes.reduce((a, b) => a + b, 0) / avgResponseTimes.length : 0;
  return {
    agents: sortedAgents,
    summary: {
      totalAgents: agents.length,
      activeAgents,
      totalChats,
      totalMessages,
      avgResponseTime: formatResponseTime(overallAvgResponseTime)
    },
    period: filter.period
  };
}
function calculateAvgResponseTime(inboundMessages, outboundMessages) {
  let totalTime = 0;
  let count = 0;
  for (const inbound of inboundMessages) {
    const inboundTime = new Date(inbound.timestamp || inbound.createdAt).getTime();
    const response = outboundMessages.find((out) => {
      const outTime = new Date(out.timestamp || out.createdAt).getTime();
      return out.contactId === inbound.contactId && outTime > inboundTime && outTime - inboundTime < 3e5;
    });
    if (response) {
      const responseTime = new Date(response.timestamp || response.createdAt).getTime();
      totalTime += responseTime - inboundTime;
      count++;
    }
  }
  return count > 0 ? totalTime / count : 0;
}
function formatResponseTime(ms) {
  if (ms === 0) return "N/A";
  const seconds = Math.floor(ms / 1e3);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}
async function getCustomerReplies(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const messages = await mongodb.readCollection("messages");
  const contacts = await mongodb.readCollection("contacts");
  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const inboundMessages = messages.filter((m) => {
    const timestamp = new Date(m.timestamp || m.createdAt);
    return m.direction === "inbound" && timestamp >= startDate && timestamp <= endDate;
  });
  const recentReplies = inboundMessages.sort((a, b) => new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime()).slice(0, 50).map((m) => {
    const contact = contactMap.get(m.contactId);
    const timeDiff = Date.now() - new Date(m.timestamp || m.createdAt).getTime();
    return {
      id: m.id,
      contactId: m.contactId,
      name: contact?.name || `Unknown (${m.contactId})`,
      phone: contact?.phone || "",
      message: m.content?.substring(0, 100) + (m.content?.length > 100 ? "..." : ""),
      fullMessage: m.content,
      time: formatTimeAgo(timeDiff),
      timestamp: m.timestamp || m.createdAt,
      type: m.type || "text",
      sentiment: analyzeSentiment(m.content)
    };
  });
  const sentimentCounts = {
    positive: recentReplies.filter((r) => r.sentiment === "Positive").length,
    negative: recentReplies.filter((r) => r.sentiment === "Negative").length,
    neutral: recentReplies.filter((r) => r.sentiment === "Neutral").length
  };
  const totalReplies = inboundMessages.length;
  const positivePercentage = totalReplies > 0 ? Math.round(sentimentCounts.positive / totalReplies * 100) : 0;
  const unsubscribeKeywords = ["stop", "unsubscribe", "remove", "opt out", "cancel"];
  const unsubscribeRequests = inboundMessages.filter(
    (m) => unsubscribeKeywords.some((kw) => m.content?.toLowerCase().includes(kw))
  ).length;
  return {
    replies: recentReplies,
    summary: {
      totalReplies,
      positiveSentiment: positivePercentage,
      unsubscribeRequests,
      sentimentBreakdown: sentimentCounts
    },
    period: filter.period
  };
}
function analyzeSentiment(text) {
  if (!text) return "Neutral";
  const positiveWords = ["yes", "thanks", "thank", "great", "good", "interested", "love", "amazing", "excellent", "perfect", "wonderful", "awesome"];
  const negativeWords = ["no", "stop", "unsubscribe", "spam", "annoying", "hate", "bad", "terrible", "worst", "cancel", "remove"];
  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter((w) => lowerText.includes(w)).length;
  const negativeCount = negativeWords.filter((w) => lowerText.includes(w)).length;
  if (positiveCount > negativeCount) return "Positive";
  if (negativeCount > positiveCount) return "Negative";
  return "Neutral";
}
function formatTimeAgo(ms) {
  const seconds = Math.floor(ms / 1e3);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  return "Just now";
}
async function getUserEngagement(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const messages = await mongodb.readCollection("messages");
  const contacts = await mongodb.readCollection("contacts");
  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const filteredMessages = messages.filter((m) => {
    const timestamp = new Date(m.timestamp || m.createdAt);
    return timestamp >= startDate && timestamp <= endDate;
  });
  const contactStats = /* @__PURE__ */ new Map();
  for (const msg of filteredMessages) {
    const contactId = msg.contactId;
    if (!contactStats.has(contactId)) {
      contactStats.set(contactId, {
        messagesReceived: 0,
        messagesRead: 0,
        replies: 0,
        contact: contactMap.get(contactId)
      });
    }
    const stats = contactStats.get(contactId);
    if (msg.direction === "outbound") {
      stats.messagesReceived++;
      if (msg.status === "read" || msg.status === "delivered") {
        stats.messagesRead++;
      }
    } else if (msg.direction === "inbound") {
      stats.replies++;
    }
  }
  const engagementData = Array.from(contactStats.entries()).map(([contactId, stats]) => {
    const readRate = stats.messagesReceived > 0 ? stats.messagesRead / stats.messagesReceived * 100 : 0;
    const replyRate = stats.messagesReceived > 0 ? stats.replies / stats.messagesReceived * 100 : 0;
    const engagement = readRate * 0.4 + replyRate * 0.6;
    return {
      id: contactId,
      name: stats.contact?.name || `Contact ${contactId.slice(0, 8)}`,
      phone: stats.contact?.phone || "",
      messagesReceived: stats.messagesReceived,
      messagesRead: stats.messagesRead,
      replies: stats.replies,
      readRate: Math.round(readRate * 10) / 10,
      replyRate: Math.round(replyRate * 10) / 10,
      engagement: Math.round(engagement * 10) / 10
    };
  });
  const sortedData = engagementData.filter((d) => d.messagesReceived > 0).sort((a, b) => b.engagement - a.engagement);
  const totalUsers = sortedData.length;
  const avgReadRate = totalUsers > 0 ? sortedData.reduce((sum, u) => sum + u.readRate, 0) / totalUsers : 0;
  const avgReplyRate = totalUsers > 0 ? sortedData.reduce((sum, u) => sum + u.replyRate, 0) / totalUsers : 0;
  const totalReplies = sortedData.reduce((sum, u) => sum + u.replies, 0);
  const totalMessages = sortedData.reduce((sum, u) => sum + u.messagesReceived, 0);
  const distribution = [
    { range: "90-100%", count: sortedData.filter((u) => u.engagement >= 90).length, color: "#22c55e" },
    { range: "80-89%", count: sortedData.filter((u) => u.engagement >= 80 && u.engagement < 90).length, color: "#84cc16" },
    { range: "70-79%", count: sortedData.filter((u) => u.engagement >= 70 && u.engagement < 80).length, color: "#eab308" },
    { range: "60-69%", count: sortedData.filter((u) => u.engagement >= 60 && u.engagement < 70).length, color: "#f97316" },
    { range: "50-59%", count: sortedData.filter((u) => u.engagement >= 50 && u.engagement < 60).length, color: "#ef4444" },
    { range: "40-49%", count: sortedData.filter((u) => u.engagement >= 40 && u.engagement < 50).length, color: "#dc2626" },
    { range: "<40%", count: sortedData.filter((u) => u.engagement < 40).length, color: "#991b1b" }
  ];
  return {
    users: sortedData.slice(0, 100),
    distribution,
    summary: {
      totalUsers,
      avgReadRate: Math.round(avgReadRate * 10) / 10,
      avgReplyRate: Math.round(avgReplyRate * 10) / 10,
      totalReplies,
      totalMessages
    },
    period: filter.period
  };
}
async function getSpendingReport(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const messages = await mongodb.readCollection("messages");
  const broadcastLogs = await mongodb.readCollection("broadcast_logs");
  const filteredMessages = messages.filter((m) => {
    const timestamp = new Date(m.timestamp || m.createdAt);
    return m.direction === "outbound" && timestamp >= startDate && timestamp <= endDate;
  });
  const MARKETING_RATE = 0.08;
  const UTILITY_RATE = 0.05;
  const SERVICE_RATE = 0.03;
  const dailyData = /* @__PURE__ */ new Map();
  for (const msg of filteredMessages) {
    const date = new Date(msg.timestamp || msg.createdAt);
    const dateKey = date.toISOString().split("T")[0];
    if (!dailyData.has(dateKey)) {
      dailyData.set(dateKey, { marketing: 0, utility: 0, service: 0, total: 0 });
    }
    const data = dailyData.get(dateKey);
    const isBroadcast = broadcastLogs.some((bl) => bl.messageId === msg.id);
    if (isBroadcast) {
      data.marketing += MARKETING_RATE;
    } else if (msg.type === "template") {
      data.utility += UTILITY_RATE;
    } else {
      data.service += SERVICE_RATE;
    }
    data.total = data.marketing + data.utility + data.service;
  }
  const dailySpending = Array.from(dailyData.entries()).map(([date, data]) => ({
    date: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
    fullDate: date,
    marketing: Math.round(data.marketing * 100) / 100,
    utility: Math.round(data.utility * 100) / 100,
    service: Math.round(data.service * 100) / 100,
    total: Math.round(data.total * 100) / 100
  })).sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()).slice(-7);
  const totalSpend = dailySpending.reduce((sum, d) => sum + d.total, 0);
  const avgDailySpend = dailySpending.length > 0 ? totalSpend / dailySpending.length : 0;
  const projectedMonthly = avgDailySpend * 30;
  const totalMarketing = dailySpending.reduce((sum, d) => sum + d.marketing, 0);
  const totalUtility = dailySpending.reduce((sum, d) => sum + d.utility, 0);
  const totalService = dailySpending.reduce((sum, d) => sum + d.service, 0);
  return {
    dailySpending,
    summary: {
      totalSpend: Math.round(totalSpend * 100) / 100,
      avgDailySpend: Math.round(avgDailySpend * 100) / 100,
      projectedMonthly: Math.round(projectedMonthly * 100) / 100,
      totalMarketing: Math.round(totalMarketing * 100) / 100,
      totalUtility: Math.round(totalUtility * 100) / 100,
      totalService: Math.round(totalService * 100) / 100,
      marketingRate: MARKETING_RATE,
      utilityRate: UTILITY_RATE,
      serviceRate: SERVICE_RATE
    },
    period: filter.period
  };
}
async function getDashboardOverview(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const messages = await mongodb.readCollection("messages");
  const contacts = await mongodb.readCollection("contacts");
  const campaigns = await mongodb.readCollection("campaigns");
  const agents = await mongodb.readCollection("agents");
  const filteredMessages = messages.filter((m) => {
    const timestamp = new Date(m.timestamp || m.createdAt);
    return timestamp >= startDate && timestamp <= endDate;
  });
  const outbound = filteredMessages.filter((m) => m.direction === "outbound");
  const inbound = filteredMessages.filter((m) => m.direction === "inbound");
  const delivered = outbound.filter((m) => m.status === "delivered" || m.status === "read");
  const read = outbound.filter((m) => m.status === "read");
  const deliveryRate = outbound.length > 0 ? delivered.length / outbound.length * 100 : 0;
  const readRate = outbound.length > 0 ? read.length / outbound.length * 100 : 0;
  const replyRate = outbound.length > 0 ? inbound.length / outbound.length * 100 : 0;
  return {
    messages: {
      total: filteredMessages.length,
      outbound: outbound.length,
      inbound: inbound.length,
      delivered: delivered.length,
      read: read.length
    },
    rates: {
      delivery: Math.round(deliveryRate * 10) / 10,
      read: Math.round(readRate * 10) / 10,
      reply: Math.round(replyRate * 10) / 10
    },
    counts: {
      contacts: contacts.length,
      campaigns: campaigns.length,
      agents: agents.length,
      activeAgents: agents.filter((a) => a.isActive).length
    },
    period: filter.period
  };
}
async function getCampaignPerformance(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const messages = await mongodb.readCollection("messages");
  const campaigns = await mongodb.readCollection("campaigns");
  const broadcastLogs = await mongodb.readCollection("broadcast_logs");
  const filteredMessages = messages.filter((m) => {
    const timestamp = new Date(m.timestamp || m.createdAt);
    return timestamp >= startDate && timestamp <= endDate;
  });
  const filteredLogs = broadcastLogs.filter((log) => {
    const timestamp = new Date(log.sentAt || log.createdAt);
    return timestamp >= startDate && timestamp <= endDate;
  });
  const campaignMap = /* @__PURE__ */ new Map();
  for (const campaign of campaigns) {
    campaignMap.set(campaign.id, {
      id: campaign.id,
      name: campaign.name,
      date: campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A",
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      failed: 0
    });
  }
  for (const log of filteredLogs) {
    const campaignName = log.campaignName || log.templateName || "Unknown Campaign";
    if (!campaignMap.has(campaignName)) {
      campaignMap.set(campaignName, {
        id: campaignName,
        name: campaignName,
        date: log.sentAt ? new Date(log.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A",
        sent: 0,
        delivered: 0,
        read: 0,
        replied: 0,
        failed: 0
      });
    }
    const campaign = campaignMap.get(campaignName);
    campaign.sent++;
    if (log.status === "delivered" || log.status === "read") {
      campaign.delivered++;
    }
    if (log.status === "read") {
      campaign.read++;
    }
    if (log.replied) {
      campaign.replied++;
    }
    if (log.status === "failed") {
      campaign.failed++;
    }
  }
  const outboundByCampaign = /* @__PURE__ */ new Map();
  for (const msg of filteredMessages) {
    if (msg.direction === "outbound" && msg.campaignId) {
      if (!outboundByCampaign.has(msg.campaignId)) {
        outboundByCampaign.set(msg.campaignId, []);
      }
      outboundByCampaign.get(msg.campaignId).push(msg);
    }
  }
  outboundByCampaign.forEach((msgs, campaignId) => {
    if (campaignMap.has(campaignId)) {
      const campaign = campaignMap.get(campaignId);
      campaign.sent += msgs.length;
      campaign.delivered += msgs.filter((m) => m.status === "delivered" || m.status === "read").length;
      campaign.read += msgs.filter((m) => m.status === "read").length;
    }
  });
  const campaignList = Array.from(campaignMap.values()).filter((c) => c.sent > 0).map((c) => ({
    ...c,
    deliveryRate: c.sent > 0 ? Math.round(c.delivered / c.sent * 100) : 0,
    readRate: c.sent > 0 ? Math.round(c.read / c.sent * 100) : 0,
    replyRate: c.sent > 0 ? Math.round(c.replied / c.sent * 100 * 10) / 10 : 0,
    cost: (c.sent * 9e-3).toFixed(2)
  })).sort((a, b) => b.sent - a.sent);
  const chartData = campaignList.slice(0, 6).map((c) => ({
    name: c.name.length > 15 ? c.name.substring(0, 15) + "..." : c.name,
    sent: c.sent,
    read: c.read,
    replied: c.replied
  }));
  const totalSent = campaignList.reduce((sum, c) => sum + c.sent, 0);
  const totalDelivered = campaignList.reduce((sum, c) => sum + c.delivered, 0);
  const totalRead = campaignList.reduce((sum, c) => sum + c.read, 0);
  const totalReplied = campaignList.reduce((sum, c) => sum + c.replied, 0);
  return {
    campaigns: campaignList,
    chartData,
    summary: {
      totalCampaigns: campaignList.length,
      totalSent,
      totalDelivered,
      totalRead,
      totalReplied,
      avgDeliveryRate: totalSent > 0 ? Math.round(totalDelivered / totalSent * 100) : 0,
      avgReadRate: totalSent > 0 ? Math.round(totalRead / totalSent * 100) : 0,
      avgReplyRate: totalSent > 0 ? Math.round(totalReplied / totalSent * 100 * 10) / 10 : 0,
      totalCost: (totalSent * 9e-3).toFixed(2)
    },
    period: filter.period
  };
}
async function getBlockedContactsReport(userId) {
  const blockedContacts = await mongodb.readCollection("blocked_contacts");
  const userBlocked = blockedContacts.filter((c) => c.userId === userId && c.isActive !== false);
  const now = /* @__PURE__ */ new Date();
  const thisMonth = userBlocked.filter((c) => {
    const blockDate = new Date(c.blockedAt);
    return blockDate.getMonth() === now.getMonth() && blockDate.getFullYear() === now.getFullYear();
  });
  const thisWeek = userBlocked.filter((c) => {
    const blockDate = new Date(c.blockedAt);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
    return blockDate >= weekAgo;
  });
  const today = userBlocked.filter((c) => {
    const blockDate = new Date(c.blockedAt);
    return blockDate.toDateString() === now.toDateString();
  });
  const withReason = userBlocked.filter((c) => c.reason && c.reason.trim() !== "");
  const reasonCounts = /* @__PURE__ */ new Map();
  for (const contact of withReason) {
    const reason = contact.reason || "No reason";
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  }
  const topReasons = Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([reason, count]) => ({ reason, count }));
  const recentBlocked = userBlocked.sort((a, b) => new Date(b.blockedAt).getTime() - new Date(a.blockedAt).getTime()).slice(0, 10);
  return {
    contacts: userBlocked,
    summary: {
      totalBlocked: userBlocked.length,
      blockedThisMonth: thisMonth.length,
      blockedThisWeek: thisWeek.length,
      blockedToday: today.length,
      withReason: withReason.length,
      topReasons
    },
    recentBlocked
  };
}
async function get24HourWindowStats(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const belongsToUser = (record) => Boolean(userId) && String(record?.userId || "") === String(userId);
  const messages = userId ? (await getTenantUsageEvents(userId)).map((message) => ({
    ...message,
    contactId: message.contactId || `${message.source}:${message.contactPhone || message.contactName}`,
    recipientPhone: message.contactPhone
  })) : [];
  const ownedContactIds = new Set(messages.map((message) => String(message.contactId)));
  const chats = (await mongodb.readCollection("chats")).filter(
    (chat) => ownedContactIds.has(String(chat.contactId))
  );
  const contactAgents = (await mongodb.readCollection("contact_agents")).filter(
    (assignment) => belongsToUser(assignment) || ownedContactIds.has(String(assignment.contactId))
  );
  const contacts = (await mongodb.readCollection("contacts")).filter(
    (contact) => ownedContactIds.has(String(contact.id))
  );
  const lastInboundMap = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    if (chat.lastInboundMessageTime) {
      lastInboundMap.set(chat.contactId, new Date(chat.lastInboundMessageTime));
    }
  }
  const filteredMessages = messages.filter((m) => {
    const timestamp = new Date(m.timestamp || m.createdAt);
    return timestamp >= startDate && timestamp <= endDate;
  });
  const outbound = filteredMessages.filter((m) => m.direction === "outbound");
  const windowEligibleOutbound = outbound.filter(
    (message) => !["broadcast", "drip"].includes(String(message.source || ""))
  );
  const inbound = filteredMessages.filter((m) => m.direction === "inbound");
  let windowCompliant = 0;
  let windowNonCompliant = 0;
  let aiInWindow = 0;
  let humanInWindow = 0;
  for (const msg of windowEligibleOutbound) {
    const lastInbound = lastInboundMap.get(msg.contactId);
    const msgTime = new Date(msg.timestamp || msg.createdAt);
    if (lastInbound) {
      const hoursDiff = (msgTime.getTime() - lastInbound.getTime()) / (1e3 * 60 * 60);
      if (hoursDiff <= 24 && hoursDiff >= 0) {
        windowCompliant++;
        if (msg.agentId && msg.agentId !== "manual") {
          aiInWindow++;
        } else {
          humanInWindow++;
        }
      } else {
        windowNonCompliant++;
      }
    } else {
      windowNonCompliant++;
    }
  }
  const contactIdByPhone = new Map(
    contacts.map((contact) => [
      String(contact.phone || "").replace(/\D/g, "").slice(-10),
      String(contact.id)
    ])
  );
  const uniqueContacts = new Set(
    filteredMessages.map((message) => {
      const phone = String(message.recipientPhone || "").replace(/\D/g, "").slice(-10);
      return phone && contactIdByPhone.get(phone) || String(message.contactId);
    })
  );
  const newContacts = contacts.filter((c) => {
    const createdAt = new Date(c.createdAt);
    return createdAt >= startDate && createdAt <= endDate;
  });
  const activeAgentAssignments = contactAgents.filter((ca) => ca.isActive);
  const aiConversations = activeAgentAssignments.length;
  const totalAiResponses = outbound.filter((m) => m.agentId && m.agentId !== "manual").length;
  const totalHumanResponses = outbound.filter((m) => !m.agentId || m.agentId === "manual").length;
  const delivered = outbound.filter((m) => ["delivered", "read"].includes(m.status)).length;
  const read = outbound.filter((m) => m.status === "read").length;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayWise = [];
  const duration = endDate.getTime() - startDate.getTime();
  const days = Math.ceil(duration / (24 * 60 * 60 * 1e3));
  const hours = Math.ceil(duration / (60 * 60 * 1e3));
  const isHourlyView = filter.period === "hour" || filter.period === "today_hourly" || filter.period === "yesterday_hourly";
  if (isHourlyView) {
    for (let h = 0; h < 24; h++) {
      const hourStart = new Date(startDate.getTime() + h * 60 * 60 * 1e3);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1e3);
      const hourMessages = filteredMessages.filter((m) => {
        const timestamp = new Date(m.timestamp || m.createdAt);
        return timestamp >= hourStart && timestamp < hourEnd;
      });
      const hourOutbound = hourMessages.filter((m) => m.direction === "outbound");
      const hourInbound = hourMessages.filter((m) => m.direction === "inbound");
      const hourDelivered = hourOutbound.filter((m) => ["delivered", "read"].includes(m.status));
      const hourRead = hourOutbound.filter((m) => m.status === "read");
      const hourAi = hourOutbound.filter((m) => m.agentId && m.agentId !== "manual");
      const hourHuman = hourOutbound.filter((m) => !m.agentId || m.agentId === "manual");
      dayWise.push({
        day: `${hourStart.getHours().toString().padStart(2, "0")}:00`,
        sent: hourOutbound.length,
        delivered: hourDelivered.length,
        read: hourRead.length,
        inbound: hourInbound.length,
        ai: hourAi.length,
        human: hourHuman.length
      });
    }
  } else {
    for (let d = 0; d < Math.min(days, 30); d++) {
      const dayStart = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1e3);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1e3);
      const dayMessages = filteredMessages.filter((m) => {
        const timestamp = new Date(m.timestamp || m.createdAt);
        return timestamp >= dayStart && timestamp < dayEnd;
      });
      const dayOutbound = dayMessages.filter((m) => m.direction === "outbound");
      const dayInbound = dayMessages.filter((m) => m.direction === "inbound");
      const dayDelivered = dayOutbound.filter((m) => ["delivered", "read"].includes(m.status));
      const dayRead = dayOutbound.filter((m) => m.status === "read");
      const dayAi = dayOutbound.filter((m) => m.agentId && m.agentId !== "manual");
      const dayHuman = dayOutbound.filter((m) => !m.agentId || m.agentId === "manual");
      dayWise.push({
        day: days <= 7 ? dayNames[dayStart.getDay()] : `${dayStart.getDate()}/${dayStart.getMonth() + 1}`,
        sent: dayOutbound.length,
        delivered: dayDelivered.length,
        read: dayRead.length,
        inbound: dayInbound.length,
        ai: dayAi.length,
        human: dayHuman.length
      });
    }
  }
  return {
    summary: {
      totalMessages: filteredMessages.length,
      outboundMessages: outbound.length,
      inboundMessages: inbound.length,
      delivered,
      read,
      deliveryRate: outbound.length > 0 ? Math.round(delivered / outbound.length * 100) : 0,
      readRate: delivered > 0 ? Math.round(read / delivered * 100) : 0,
      windowCompliant,
      windowNonCompliant,
      windowComplianceRate: windowEligibleOutbound.length > 0 ? Math.round(windowCompliant / windowEligibleOutbound.length * 100) : 0,
      aiInWindow,
      humanInWindow,
      totalAiResponses,
      totalHumanResponses,
      aiPercentage: outbound.length > 0 ? Math.round(totalAiResponses / outbound.length * 100) : 0,
      activeContacts: uniqueContacts.size,
      newContacts: newContacts.length,
      aiConversations
    },
    dayWise,
    period: filter.period
  };
}
const emptyDashboardSummary = () => ({
  totalMessages: 0,
  outboundMessages: 0,
  inboundMessages: 0,
  delivered: 0,
  read: 0,
  deliveryRate: 0,
  readRate: 0,
  windowCompliant: 0,
  windowNonCompliant: 0,
  windowComplianceRate: 0,
  aiInWindow: 0,
  humanInWindow: 0,
  totalAiResponses: 0,
  totalHumanResponses: 0,
  aiPercentage: 0,
  activeContacts: 0,
  newContacts: 0,
  aiConversations: 0
});
const getFastDashboardStatsForRange = async (filter, userId, startDate, endDate) => {
  if (!userId) {
    return {
      summary: emptyDashboardSummary(),
      dayWise: [],
      period: filter.period
    };
  }
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();
  const isHourlyView = filter.period === "hour" || filter.period === "today_hourly" || filter.period === "yesterday_hourly";
  const bucketCount = isHourlyView ? 24 : Math.min(
    Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1e3)),
    30
  );
  const bucketMs = isHourlyView ? 60 * 60 * 1e3 : 24 * 60 * 60 * 1e3;
  const bucketMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = new Date(startDate.getTime() + i * bucketMs);
    if (!isHourlyView) bucketStart.setHours(0, 0, 0, 0);
    const key = bucketStart.toISOString();
    bucketMap.set(key, {
      day: isHourlyView ? `${bucketStart.getHours().toString().padStart(2, "0")}:00` : bucketCount <= 7 ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][bucketStart.getDay()] : `${bucketStart.getDate()}/${bucketStart.getMonth() + 1}`,
      sent: 0,
      delivered: 0,
      read: 0,
      inbound: 0,
      ai: 0,
      human: 0
    });
  }
  const addBucketRows = (rows) => {
    rows.forEach((row) => {
      const bucketDate = new Date(row._id);
      if (!isHourlyView) bucketDate.setHours(0, 0, 0, 0);
      const key = bucketDate.toISOString();
      const bucket = bucketMap.get(key);
      if (!bucket) return;
      bucket.sent += row.outbound || 0;
      bucket.delivered += row.delivered || 0;
      bucket.read += row.read || 0;
      bucket.inbound += row.inbound || 0;
      bucket.ai += row.ai || 0;
      bucket.human += row.human || 0;
    });
  };
  const messageMatch = {
    userId,
    timestamp: { $gte: startIso, $lte: endIso }
  };
  const broadcastMatch = {
    userId,
    timestamp: { $gte: startIso, $lte: endIso }
  };
  const campaignMatch = {
    userId,
    $or: [
      { sentAt: { $gte: startDate, $lte: endDate } },
      { sendAttemptedAt: { $gte: startDate, $lte: endDate } },
      { createdAt: { $gte: startDate, $lte: endDate } }
    ]
  };
  const bucketFormat = isHourlyView ? "%Y-%m-%dT%H:00:00.000Z" : "%Y-%m-%dT00:00:00.000Z";
  const [
    messageSummaryRows,
    messageBucketRows,
    broadcastSummaryRows,
    broadcastBucketRows,
    campaignSummaryRows,
    campaignBucketRows,
    activeContacts,
    newContacts,
    aiConversations
  ] = await Promise.all([
    mongodb.Message.aggregate([
      { $match: messageMatch },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          outboundMessages: { $sum: { $cond: [{ $eq: ["$direction", "outbound"] }, 1, 0] } },
          inboundMessages: { $sum: { $cond: [{ $eq: ["$direction", "inbound"] }, 1, 0] } },
          delivered: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$direction", "outbound"] }, { $in: ["$status", ["delivered", "read"]] }] },
                1,
                0
              ]
            }
          },
          read: { $sum: { $cond: [{ $and: [{ $eq: ["$direction", "outbound"] }, { $eq: ["$status", "read"] }] }, 1, 0] } },
          totalAiResponses: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$direction", "outbound"] }, { $not: [{ $in: ["$agentId", [null, "", "manual"]] }] }] },
                1,
                0
              ]
            }
          },
          activeContacts: { $addToSet: "$contactId" }
        }
      }
    ]).allowDiskUse(true),
    mongodb.Message.aggregate([
      { $match: messageMatch },
      { $addFields: { bucketDate: { $dateFromString: { dateString: "$timestamp", onError: null, onNull: null } } } },
      { $match: { bucketDate: { $ne: null } } },
      {
        $group: {
          _id: { $dateToString: { format: bucketFormat, date: "$bucketDate", timezone: "UTC" } },
          outbound: { $sum: { $cond: [{ $eq: ["$direction", "outbound"] }, 1, 0] } },
          inbound: { $sum: { $cond: [{ $eq: ["$direction", "inbound"] }, 1, 0] } },
          delivered: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$direction", "outbound"] }, { $in: ["$status", ["delivered", "read"]] }] },
                1,
                0
              ]
            }
          },
          read: { $sum: { $cond: [{ $and: [{ $eq: ["$direction", "outbound"] }, { $eq: ["$status", "read"] }] }, 1, 0] } },
          ai: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$direction", "outbound"] }, { $not: [{ $in: ["$agentId", [null, "", "manual"]] }] }] },
                1,
                0
              ]
            }
          },
          human: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$direction", "outbound"] }, { $in: ["$agentId", [null, "", "manual"]] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]).allowDiskUse(true),
    mongodb.BroadcastLog.aggregate([
      { $match: broadcastMatch },
      {
        $group: {
          _id: null,
          outboundMessages: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "read"]] }, 1, 0] } },
          read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } },
          activeContacts: { $addToSet: "$contactPhone" }
        }
      }
    ]).allowDiskUse(true),
    mongodb.BroadcastLog.aggregate([
      { $match: broadcastMatch },
      { $addFields: { bucketDate: { $dateFromString: { dateString: "$timestamp", onError: null, onNull: null } } } },
      { $match: { bucketDate: { $ne: null } } },
      {
        $group: {
          _id: { $dateToString: { format: bucketFormat, date: "$bucketDate", timezone: "UTC" } },
          outbound: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "read"]] }, 1, 0] } },
          read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } },
          human: { $sum: 1 }
        }
      }
    ]).allowDiskUse(true),
    mongodb.CampaignLog.aggregate([
      { $match: campaignMatch },
      {
        $group: {
          _id: null,
          outboundMessages: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "read"]] }, 1, 0] } },
          read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } },
          activeContacts: { $addToSet: "$contact" }
        }
      }
    ]).allowDiskUse(true),
    mongodb.CampaignLog.aggregate([
      { $match: campaignMatch },
      { $addFields: { eventDate: { $ifNull: ["$sentAt", { $ifNull: ["$sendAttemptedAt", "$createdAt"] }] } } },
      {
        $group: {
          _id: { $dateToString: { format: bucketFormat, date: "$eventDate", timezone: "UTC" } },
          outbound: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "read"]] }, 1, 0] } },
          read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } },
          human: { $sum: 1 }
        }
      }
    ]).allowDiskUse(true),
    mongodb.Contact.distinct("id", { userId }),
    mongodb.Contact.countDocuments({ userId, createdAt: { $gte: startIso, $lte: endIso } }),
    mongodb.ContactAgent.countDocuments({ isActive: true })
  ]);
  addBucketRows(messageBucketRows);
  addBucketRows(broadcastBucketRows);
  addBucketRows(campaignBucketRows);
  const messageSummary = messageSummaryRows[0] || {};
  const broadcastSummary = broadcastSummaryRows[0] || {};
  const campaignSummary = campaignSummaryRows[0] || {};
  const outboundMessages = (messageSummary.outboundMessages || 0) + (broadcastSummary.outboundMessages || 0) + (campaignSummary.outboundMessages || 0);
  const inboundMessages = messageSummary.inboundMessages || 0;
  const delivered = (messageSummary.delivered || 0) + (broadcastSummary.delivered || 0) + (campaignSummary.delivered || 0);
  const read = (messageSummary.read || 0) + (broadcastSummary.read || 0) + (campaignSummary.read || 0);
  const totalAiResponses = messageSummary.totalAiResponses || 0;
  const totalHumanResponses = outboundMessages - totalAiResponses;
  const contactKeys = new Set([
    ...messageSummary.activeContacts || [],
    ...broadcastSummary.activeContacts || [],
    ...campaignSummary.activeContacts || []
  ].filter(Boolean).map(String));
  return {
    summary: {
      totalMessages: outboundMessages + inboundMessages,
      outboundMessages,
      inboundMessages,
      delivered,
      read,
      deliveryRate: outboundMessages > 0 ? Math.round(delivered / outboundMessages * 100) : 0,
      readRate: delivered > 0 ? Math.round(read / delivered * 100) : 0,
      windowCompliant: 0,
      windowNonCompliant: 0,
      windowComplianceRate: 0,
      aiInWindow: 0,
      humanInWindow: 0,
      totalAiResponses,
      totalHumanResponses,
      aiPercentage: outboundMessages > 0 ? Math.round(totalAiResponses / outboundMessages * 100) : 0,
      activeContacts: contactKeys.size || activeContacts.length,
      newContacts,
      aiConversations
    },
    dayWise: Array.from(bucketMap.values()),
    period: filter.period
  };
};
async function getEnhancedDashboardStats(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const previousDuration = endDate.getTime() - startDate.getTime();
  const previousStartDate = new Date(startDate.getTime() - previousDuration);
  const previousEndDate = new Date(startDate.getTime());
  const [currentStats, previousStats] = await Promise.all([
    getFastDashboardStatsForRange(filter, userId, startDate, endDate),
    getFastDashboardStatsForRange(
      { period: "custom", startDate: previousStartDate.toISOString(), endDate: previousEndDate.toISOString() },
      userId,
      previousStartDate,
      previousEndDate
    )
  ]);
  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round((current - previous) / previous * 100);
  };
  return {
    ...currentStats,
    changes: {
      messagesChange: calculateChange(currentStats.summary.totalMessages, previousStats.summary.totalMessages),
      outboundChange: calculateChange(currentStats.summary.outboundMessages, previousStats.summary.outboundMessages),
      deliveredChange: calculateChange(currentStats.summary.delivered, previousStats.summary.delivered),
      readRateChange: calculateChange(currentStats.summary.readRate, previousStats.summary.readRate),
      aiChange: calculateChange(currentStats.summary.totalAiResponses, previousStats.summary.totalAiResponses),
      newContactsChange: calculateChange(currentStats.summary.newContacts, previousStats.summary.newContacts),
      windowComplianceChange: calculateChange(currentStats.summary.windowComplianceRate, previousStats.summary.windowComplianceRate)
    }
  };
}
const reportsService = {
  getDateRange,
  getAIAgentPerformance,
  getCustomerReplies,
  getUserEngagement,
  getSpendingReport,
  get24HourWindowStats,
  getEnhancedDashboardStats,
  getDashboardOverview,
  getCampaignPerformance,
  getBlockedContactsReport
};
export {
  get24HourWindowStats,
  getAIAgentPerformance,
  getBlockedContactsReport,
  getCampaignPerformance,
  getCustomerReplies,
  getDashboardOverview,
  getDateRange,
  getEnhancedDashboardStats,
  getSpendingReport,
  getUserEngagement,
  reportsService
};
