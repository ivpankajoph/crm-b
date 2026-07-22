import { Message, ContactAgent } from "../storage/mongodb.adapter.js";
import * as mongodb from "../storage/mongodb.adapter.js";
function getDateRange(filter) {
  const now = /* @__PURE__ */ new Date();
  let start;
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (filter.period === "custom" && filter.startDate && filter.endDate) {
    start = new Date(filter.startDate);
    end = new Date(filter.endDate);
    end.setHours(23, 59, 59, 999);
  } else {
    switch (filter.period) {
      case "day":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      case "week":
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case "month":
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
    }
  }
  return { start, end };
}
async function getBillingSummary(userId, filter) {
  const { start, end } = getDateRange(filter);
  const COST_PER_MESSAGE = 1;
  const messages = await Message.find({
    timestamp: {
      $gte: start.toISOString(),
      $lte: end.toISOString()
    }
  }).lean();
  const userMessages = messages.filter((m) => m.direction === "inbound");
  const aiMessages = messages.filter((m) => m.direction === "outbound" && m.agentId);
  const contactAgents = await ContactAgent.find({}).lean();
  const contactAgentMap = /* @__PURE__ */ new Map();
  for (const ca of contactAgents) {
    if (ca.contactId && ca.agentId) {
      contactAgentMap.set(ca.contactId, { agentId: ca.agentId, agentName: ca.agentName || "Unknown Agent" });
    }
  }
  const agents = await mongodb.readCollection("agents");
  const agentMap = /* @__PURE__ */ new Map();
  for (const agent of agents) {
    agentMap.set(agent.id, agent.name);
  }
  const agentStats = {};
  for (const msg of aiMessages) {
    const agentId = msg.agentId || "unknown";
    let agentName = agentMap.get(agentId) || "Unknown Agent";
    if (!agentStats[agentId]) {
      agentStats[agentId] = {
        agentId,
        agentName,
        conversations: /* @__PURE__ */ new Set(),
        messages: 0
      };
    }
    agentStats[agentId].conversations.add(msg.contactId);
    agentStats[agentId].messages++;
  }
  const agentBreakdown = Object.values(agentStats).map((stat) => ({
    agentId: stat.agentId,
    agentName: stat.agentName,
    conversationCount: stat.conversations.size,
    messageCount: stat.messages,
    cost: stat.messages * COST_PER_MESSAGE
  })).sort((a, b) => b.messageCount - a.messageCount);
  const dailyMap = {};
  for (const msg of messages) {
    const date = new Date(msg.timestamp).toISOString().split("T")[0];
    if (!dailyMap[date]) {
      dailyMap[date] = { userMessages: 0, aiMessages: 0 };
    }
    if (msg.direction === "inbound") {
      dailyMap[date].userMessages++;
    } else if (msg.direction === "outbound" && msg.agentId) {
      dailyMap[date].aiMessages++;
    }
  }
  const dailyBreakdown = Object.entries(dailyMap).map(([date, stats]) => ({
    date,
    userMessages: stats.userMessages,
    aiMessages: stats.aiMessages,
    totalMessages: stats.userMessages + stats.aiMessages,
    cost: (stats.userMessages + stats.aiMessages) * COST_PER_MESSAGE
  })).sort((a, b) => a.date.localeCompare(b.date));
  const uniqueContacts = /* @__PURE__ */ new Set();
  for (const msg of messages) {
    uniqueContacts.add(msg.contactId);
  }
  const totalBillableMessages = userMessages.length + aiMessages.length;
  return {
    userId,
    userName: "User",
    period: {
      start: start.toISOString(),
      end: end.toISOString()
    },
    metrics: {
      totalMessages: totalBillableMessages,
      userMessages: userMessages.length,
      aiMessages: aiMessages.length,
      totalConversations: uniqueContacts.size,
      totalCost: totalBillableMessages * COST_PER_MESSAGE,
      costPerMessage: COST_PER_MESSAGE
    },
    agentBreakdown,
    dailyBreakdown
  };
}
async function getConversationsBilling(userId, filter, pagination) {
  const { start, end } = getDateRange(filter);
  const COST_PER_MESSAGE = 1;
  const messages = await Message.find({
    timestamp: {
      $gte: start.toISOString(),
      $lte: end.toISOString()
    }
  }).lean();
  const contacts = await mongodb.readCollection("contacts");
  const contactMap = /* @__PURE__ */ new Map();
  for (const contact of contacts) {
    contactMap.set(contact.id, { name: contact.name, phone: contact.phone });
  }
  const agents = await mongodb.readCollection("agents");
  const agentMap = /* @__PURE__ */ new Map();
  for (const agent of agents) {
    agentMap.set(agent.id, agent.name);
  }
  const conversationStats = {};
  for (const msg of messages) {
    if (!conversationStats[msg.contactId]) {
      conversationStats[msg.contactId] = {
        contactId: msg.contactId,
        userMessages: 0,
        aiMessages: 0,
        agentId: null,
        lastMessageAt: msg.timestamp
      };
    }
    const stat = conversationStats[msg.contactId];
    if (msg.direction === "inbound") {
      stat.userMessages++;
    } else if (msg.direction === "outbound" && msg.agentId) {
      stat.aiMessages++;
      stat.agentId = msg.agentId;
    }
    if (new Date(msg.timestamp) > new Date(stat.lastMessageAt)) {
      stat.lastMessageAt = msg.timestamp;
    }
  }
  const allConversations = Object.values(conversationStats).map((stat) => {
    const contact = contactMap.get(stat.contactId) || { name: "Unknown", phone: "Unknown" };
    const totalMessages = stat.userMessages + stat.aiMessages;
    return {
      contactId: stat.contactId,
      contactName: contact.name,
      contactPhone: contact.phone,
      userMessages: stat.userMessages,
      aiMessages: stat.aiMessages,
      totalMessages,
      cost: totalMessages * COST_PER_MESSAGE,
      agentName: stat.agentId ? agentMap.get(stat.agentId) || "Unknown Agent" : null,
      lastMessageAt: stat.lastMessageAt
    };
  }).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  const total = allConversations.length;
  const paginated = allConversations.slice(pagination.offset, pagination.offset + pagination.limit);
  return {
    conversations: paginated,
    total
  };
}
async function getAllUsersBillingSummary(filter) {
  const { start, end } = getDateRange(filter);
  const COST_PER_MESSAGE = 1;
  const messages = await Message.find({
    timestamp: {
      $gte: start.toISOString(),
      $lte: end.toISOString()
    }
  }).lean();
  const userMessages = messages.filter((m) => m.direction === "inbound");
  const aiMessages = messages.filter((m) => m.direction === "outbound" && m.agentId);
  const totalBillable = userMessages.length + aiMessages.length;
  const uniqueContacts = /* @__PURE__ */ new Set();
  for (const msg of messages) {
    uniqueContacts.add(msg.contactId);
  }
  return {
    users: [{
      userId: "all",
      userName: "All Users",
      totalMessages: totalBillable,
      userMessages: userMessages.length,
      aiMessages: aiMessages.length,
      totalConversations: uniqueContacts.size,
      totalCost: totalBillable * COST_PER_MESSAGE
    }],
    grandTotal: {
      totalMessages: totalBillable,
      userMessages: userMessages.length,
      aiMessages: aiMessages.length,
      totalConversations: uniqueContacts.size,
      totalCost: totalBillable * COST_PER_MESSAGE
    }
  };
}
const billingService = {
  getBillingSummary,
  getConversationsBilling,
  getAllUsersBillingSummary
};
export {
  billingService,
  getAllUsersBillingSummary,
  getBillingSummary,
  getConversationsBilling
};
