import * as mongodb from "../storage/mongodb.adapter.js";
import { generateAIResponse } from "../ai/ai.service.js";
const INTEREST_ANALYSIS_PROMPT = `You are an expert sales analyst. Analyze the WhatsApp conversation below and determine the customer's interest level.

IMPORTANT: You MUST respond with ONLY a valid JSON object. No explanations, no markdown, no text before or after. Just pure JSON.

Required JSON format:
{"interestLevel":"interested","interestScore":75,"interestReason":"Customer asked about pricing","keyTopics":["award","pricing"],"objections":[],"positiveSignals":["asked questions"],"negativeSignals":[]}

Field rules:
- interestLevel: MUST be exactly one of: "highly_interested", "interested", "neutral", "not_interested"
- interestScore: number from 1-100
- interestReason: short string explaining your assessment
- keyTopics, objections, positiveSignals, negativeSignals: arrays of strings (can be empty [])

Interest Level Guidelines:
- highly_interested (score 75-100): Customer wants to proceed, asks about payment, provides details eagerly
- interested (score 50-74): Customer shows positive engagement, asks questions, considers the offer
- neutral (score 25-49): Customer is non-committal, short responses, neither positive nor negative
- not_interested (score 1-24): Customer declines, shows disinterest, stops responding, or says no

Conversation to analyze:
`;
async function analyzeContactConversation(phone, messages, userId) {
  if (messages.length === 0) {
    return {
      interestLevel: "pending",
      interestScore: 0,
      interestReason: "No conversation history available",
      keyTopics: [],
      objections: [],
      positiveSignals: [],
      negativeSignals: []
    };
  }
  const conversationText = messages.map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`).join("\n");
  try {
    const response = await generateAIResponse(
      [
        { role: "system", content: INTEREST_ANALYSIS_PROMPT },
        { role: "user", content: conversationText }
      ],
      { id: "analysis", name: "Conversation Analyzer", model: "gemini-2.5-flash", temperature: 0.1 },
      userId
    );
    let cleanedResponse = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    }
    const analysis = JSON.parse(cleanedResponse);
    return {
      interestLevel: analysis.interestLevel || "neutral",
      interestScore: analysis.interestScore || 50,
      interestReason: analysis.interestReason || "Unable to determine",
      keyTopics: analysis.keyTopics || [],
      objections: analysis.objections || [],
      positiveSignals: analysis.positiveSignals || [],
      negativeSignals: analysis.negativeSignals || []
    };
  } catch (error) {
    console.error("[ContactAnalytics] Error analyzing conversation:", error);
    const userMessages = messages.filter((m) => m.role === "user");
    const hasPositive = userMessages.some(
      (m) => /interested|yes|sure|okay|want|need|details|price|payment/i.test(m.content)
    );
    const hasNegative = userMessages.some(
      (m) => /no|not interested|later|busy|expensive|can't|don't/i.test(m.content)
    );
    return {
      interestLevel: hasPositive && !hasNegative ? "interested" : hasNegative ? "not_interested" : "neutral",
      interestScore: hasPositive ? 60 : hasNegative ? 30 : 50,
      interestReason: "Keyword-based analysis (AI analysis failed)",
      keyTopics: [],
      objections: [],
      positiveSignals: hasPositive ? ["Shows interest in keywords"] : [],
      negativeSignals: hasNegative ? ["Shows disinterest in keywords"] : []
    };
  }
}
async function getOrCreateContactAnalytics(contactId, phone, contactName) {
  const normalizedPhone = phone.replace(/\D/g, "");
  let analytics = await mongodb.findOne("contact_analytics", {
    $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ]
  });
  if (!analytics) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    analytics = {
      id: `ca-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      contactId,
      phone: normalizedPhone,
      contactName,
      interestLevel: "pending",
      interestScore: 0,
      interestReason: "Not yet analyzed",
      totalMessages: 0,
      inboundMessages: 0,
      outboundMessages: 0,
      aiAgentInteractions: [],
      firstContactTime: now,
      lastContactTime: now,
      conversationDuration: 0,
      keyTopics: [],
      objections: [],
      positiveSignals: [],
      negativeSignals: [],
      lastAnalyzedAt: "",
      createdAt: now,
      updatedAt: now
    };
    await mongodb.insertOne("contact_analytics", analytics);
  }
  return analytics;
}
async function updateContactAnalytics(phone, updates) {
  const normalizedPhone = phone.replace(/\D/g, "");
  return mongodb.updateOne(
    "contact_analytics",
    { $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ] },
    { ...updates, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }
  );
}
async function trackAgentInteraction(phone, agentId, agentName) {
  const normalizedPhone = phone.replace(/\D/g, "");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const analytics = await mongodb.findOne("contact_analytics", {
    $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ]
  });
  if (!analytics) return;
  const existingInteraction = analytics.aiAgentInteractions.find((i) => i.agentId === agentId);
  if (existingInteraction) {
    existingInteraction.messagesCount++;
    existingInteraction.lastInteraction = now;
    const firstTime = new Date(existingInteraction.firstInteraction).getTime();
    const lastTime = new Date(now).getTime();
    existingInteraction.durationMinutes = Math.round((lastTime - firstTime) / 6e4);
  } else {
    analytics.aiAgentInteractions.push({
      agentId,
      agentName,
      messagesCount: 1,
      firstInteraction: now,
      lastInteraction: now,
      durationMinutes: 0
    });
  }
  await mongodb.updateOne(
    "contact_analytics",
    { id: analytics.id },
    {
      aiAgentInteractions: analytics.aiAgentInteractions,
      lastContactTime: now,
      updatedAt: now
    }
  );
}
async function getContactReport(phone, userId) {
  const normalizedPhone = phone.replace(/\D/g, "");
  const analytics = await mongodb.findOne("contact_analytics", {
    $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ]
  });
  return analytics;
}
async function getAllContactReports(filter) {
  const allAnalytics = await mongodb.readCollection("contact_analytics");
  let filtered = allAnalytics;
  if (filter?.interestLevel && filter.interestLevel !== "all") {
    filtered = allAnalytics.filter((a) => a.interestLevel === filter.interestLevel);
  }
  filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const offset = filter?.offset || 0;
  const limit = filter?.limit || 50;
  const paginated = filtered.slice(offset, offset + limit);
  return {
    reports: paginated,
    total: filtered.length
  };
}
async function analyzeAndUpdateContact(contactId, phone, contactName, messages, userId) {
  const analytics = await getOrCreateContactAnalytics(contactId, phone, contactName);
  const conversationMessages = messages.map((m) => ({
    role: m.direction === "inbound" ? "user" : "assistant",
    content: m.content,
    timestamp: m.timestamp || m.createdAt
  }));
  const analysis = await analyzeContactConversation(phone, conversationMessages, userId);
  const inbound = messages.filter((m) => m.direction === "inbound").length;
  const outbound = messages.filter((m) => m.direction === "outbound").length;
  let firstTime = analytics.firstContactTime;
  let lastTime = analytics.lastContactTime;
  if (messages.length > 0) {
    const sortedMessages = [...messages].sort(
      (a, b) => new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime()
    );
    firstTime = sortedMessages[0].timestamp || sortedMessages[0].createdAt;
    lastTime = sortedMessages[sortedMessages.length - 1].timestamp || sortedMessages[sortedMessages.length - 1].createdAt;
  }
  const durationMinutes = Math.round(
    (new Date(lastTime).getTime() - new Date(firstTime).getTime()) / 6e4
  );
  const updated = await updateContactAnalytics(phone, {
    contactName,
    interestLevel: analysis.interestLevel,
    interestScore: analysis.interestScore,
    interestReason: analysis.interestReason,
    totalMessages: messages.length,
    inboundMessages: inbound,
    outboundMessages: outbound,
    keyTopics: analysis.keyTopics,
    objections: analysis.objections,
    positiveSignals: analysis.positiveSignals,
    negativeSignals: analysis.negativeSignals,
    firstContactTime: firstTime,
    lastContactTime: lastTime,
    conversationDuration: durationMinutes,
    lastAnalyzedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  return updated || analytics;
}
async function getContactAnalyticsSummary() {
  const allAnalytics = await mongodb.readCollection("contact_analytics");
  const total = allAnalytics.length;
  const interestCounts = {
    highly_interested: 0,
    interested: 0,
    neutral: 0,
    not_interested: 0,
    pending: 0
  };
  let totalScore = 0;
  const agentContactsMap = {};
  for (const analytics of allAnalytics) {
    interestCounts[analytics.interestLevel] = (interestCounts[analytics.interestLevel] || 0) + 1;
    totalScore += analytics.interestScore;
    for (const interaction of analytics.aiAgentInteractions) {
      agentContactsMap[interaction.agentName] = (agentContactsMap[interaction.agentName] || 0) + 1;
    }
  }
  const byInterestLevel = Object.entries(interestCounts).map(([level, count]) => ({
    level,
    count,
    percentage: total > 0 ? Math.round(count / total * 100) : 0
  }));
  const topAgents = Object.entries(agentContactsMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([agentName, contactsHandled]) => ({ agentName, contactsHandled }));
  return {
    total,
    byInterestLevel,
    averageScore: total > 0 ? Math.round(totalScore / total) : 0,
    topAgents
  };
}
const contactAnalyticsService = {
  analyzeContactConversation,
  getOrCreateContactAnalytics,
  updateContactAnalytics,
  trackAgentInteraction,
  getContactReport,
  getAllContactReports,
  analyzeAndUpdateContact,
  getContactAnalyticsSummary
};
export {
  analyzeAndUpdateContact,
  analyzeContactConversation,
  contactAnalyticsService,
  getAllContactReports,
  getContactAnalyticsSummary,
  getContactReport,
  getOrCreateContactAnalytics,
  trackAgentInteraction,
  updateContactAnalytics
};
