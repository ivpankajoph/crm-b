import * as mongodb from "../storage/mongodb.adapter.js";
const INTEREST_KEYWORDS = [
  "interested",
  "yes",
  "tell me more",
  "how much",
  "price",
  "cost",
  "register",
  "sign up",
  "book",
  "schedule",
  "appointment",
  "buy",
  "purchase",
  "order",
  "want",
  "need",
  "looking for",
  "details",
  "more information",
  "brochure",
  "catalog",
  "demo",
  "trial",
  "subscribe",
  "join",
  "apply",
  "confirm",
  "proceed",
  "next steps"
];
const NOT_INTERESTED_KEYWORDS = [
  "not interested",
  "no thanks",
  "no thank you",
  "stop",
  "unsubscribe",
  "remove",
  "don't contact",
  "spam",
  "wrong number",
  "busy",
  "later",
  "not now",
  "maybe later",
  "not looking",
  "already have",
  "not for me"
];
function generateId() {
  return "qual_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
async function getQualifications() {
  return mongodb.readCollection("ai_qualifications");
}
async function getQualificationById(id) {
  const result = await mongodb.findOne("ai_qualifications", { id });
  return result || void 0;
}
async function getQualificationByPhone(phone) {
  if (!phone) return void 0;
  const qualifications = await getQualifications();
  const normalizedPhone = (phone || "").replace(/\D/g, "");
  if (!normalizedPhone) return void 0;
  return qualifications.find((q) => {
    const qPhone = (q.phone || "").replace(/\D/g, "");
    return qPhone.includes(normalizedPhone) || normalizedPhone.includes(qPhone);
  });
}
async function getQualificationsByCategory(category) {
  return mongodb.findMany("ai_qualifications", { category });
}
async function getQualificationsBySource(source) {
  return mongodb.findMany("ai_qualifications", { source });
}
async function getQualificationsByCampaign(campaignId) {
  return mongodb.findMany("ai_qualifications", { campaignId });
}
async function getQualificationsByAgent(agentId) {
  return mongodb.findMany("ai_qualifications", { agentId });
}
async function getQualificationStats() {
  const qualifications = await getQualifications();
  const total = qualifications.length;
  const interested = qualifications.filter((q) => q.category === "interested").length;
  const notInterested = qualifications.filter((q) => q.category === "not_interested").length;
  const pending = qualifications.filter((q) => q.category === "pending").length;
  return {
    total,
    interested,
    notInterested,
    pending,
    interestedPercent: total > 0 ? Math.round(interested / total * 100) : 0,
    notInterestedPercent: total > 0 ? Math.round(notInterested / total * 100) : 0,
    pendingPercent: total > 0 ? Math.round(pending / total * 100) : 0
  };
}
function analyzeMessage(message) {
  if (!message) {
    return { category: "pending", score: 50, keywords: [] };
  }
  const lowerMessage = (message || "").toLowerCase();
  const foundInterestKeywords = [];
  const foundNotInterestedKeywords = [];
  for (const keyword of INTEREST_KEYWORDS) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      foundInterestKeywords.push(keyword);
    }
  }
  for (const keyword of NOT_INTERESTED_KEYWORDS) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      foundNotInterestedKeywords.push(keyword);
    }
  }
  let score = 50;
  let category = "pending";
  if (foundNotInterestedKeywords.length > 0) {
    score = Math.max(0, 50 - foundNotInterestedKeywords.length * 20);
    category = "not_interested";
  } else if (foundInterestKeywords.length > 0) {
    score = Math.min(100, 50 + foundInterestKeywords.length * 15);
    category = "interested";
  }
  return {
    category,
    score,
    keywords: [...foundInterestKeywords, ...foundNotInterestedKeywords]
  };
}
async function createOrUpdateQualification(phone, name, message, source, options) {
  if (!phone) {
    throw new Error("Phone is required for AI qualification tracking");
  }
  const normalizedPhone = (phone || "").replace(/\D/g, "");
  const existing = await getQualificationByPhone(normalizedPhone);
  const analysis = analyzeMessage(message || "");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (existing) {
    const updatedKeywords = Array.from(/* @__PURE__ */ new Set([...existing.keywords, ...analysis.keywords]));
    let newCategory = existing.category;
    let newScore = existing.score;
    if (analysis.category === "interested" && analysis.score > existing.score) {
      newCategory = "interested";
      newScore = analysis.score;
    } else if (analysis.category === "not_interested") {
      newCategory = "not_interested";
      newScore = analysis.score;
    } else if (existing.category === "pending" && analysis.category !== "pending") {
      newCategory = analysis.category;
      newScore = analysis.score;
    }
    const updated = {
      ...existing,
      category: newCategory,
      score: newScore,
      totalMessages: existing.totalMessages + 1,
      lastMessageAt: now,
      keywords: updatedKeywords,
      updatedAt: now,
      campaignId: options?.campaignId || existing.campaignId,
      campaignName: options?.campaignName || existing.campaignName,
      agentId: options?.agentId || existing.agentId,
      agentName: options?.agentName || existing.agentName
    };
    await mongodb.updateOne("ai_qualifications", { id: existing.id }, updated);
    return updated;
  } else {
    const newQualification = {
      id: generateId(),
      contactId: options?.contactId || generateId(),
      phone: normalizedPhone,
      name: name || `+${normalizedPhone}`,
      source,
      campaignId: options?.campaignId,
      campaignName: options?.campaignName,
      agentId: options?.agentId,
      agentName: options?.agentName,
      category: analysis.category,
      score: analysis.score,
      totalMessages: 1,
      lastMessageAt: now,
      firstContactAt: now,
      keywords: analysis.keywords,
      notes: "",
      createdAt: now,
      updatedAt: now
    };
    await mongodb.insertOne("ai_qualifications", newQualification);
    return newQualification;
  }
}
async function updateQualificationCategory(id, category, notes) {
  const existing = await getQualificationById(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    category,
    notes: notes || existing.notes,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await mongodb.updateOne("ai_qualifications", { id }, updated);
  return updated;
}
async function updateQualificationNotes(id, notes) {
  const existing = await getQualificationById(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    notes,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await mongodb.updateOne("ai_qualifications", { id }, updated);
  return updated;
}
async function deleteQualification(id) {
  return mongodb.deleteOne("ai_qualifications", { id });
}
async function getQualificationReport() {
  const qualifications = await getQualifications();
  const bySource = {};
  const sources = ["ai_chat", "campaign", "ad", "lead_form", "manual"];
  for (const source of sources) {
    const sourceQuals = qualifications.filter((q) => q.source === source);
    const total = sourceQuals.length;
    const interested = sourceQuals.filter((q) => q.category === "interested").length;
    const notInterested = sourceQuals.filter((q) => q.category === "not_interested").length;
    const pending = sourceQuals.filter((q) => q.category === "pending").length;
    bySource[source] = {
      total,
      interested,
      notInterested,
      pending,
      interestedPercent: total > 0 ? Math.round(interested / total * 100) : 0,
      notInterestedPercent: total > 0 ? Math.round(notInterested / total * 100) : 0,
      pendingPercent: total > 0 ? Math.round(pending / total * 100) : 0
    };
  }
  const byCampaign = {};
  const campaignIds = Array.from(new Set(qualifications.filter((q) => q.campaignId).map((q) => q.campaignId)));
  for (const campaignId of campaignIds) {
    const campaignQuals = qualifications.filter((q) => q.campaignId === campaignId);
    const total = campaignQuals.length;
    const interested = campaignQuals.filter((q) => q.category === "interested").length;
    const notInterested = campaignQuals.filter((q) => q.category === "not_interested").length;
    const pending = campaignQuals.filter((q) => q.category === "pending").length;
    byCampaign[campaignId] = {
      campaignName: campaignQuals[0]?.campaignName || "Unknown Campaign",
      total,
      interested,
      notInterested,
      pending,
      interestedPercent: total > 0 ? Math.round(interested / total * 100) : 0,
      notInterestedPercent: total > 0 ? Math.round(notInterested / total * 100) : 0,
      pendingPercent: total > 0 ? Math.round(pending / total * 100) : 0
    };
  }
  const byAgent = {};
  const agentIds = Array.from(new Set(qualifications.filter((q) => q.agentId).map((q) => q.agentId)));
  for (const agentId of agentIds) {
    const agentQuals = qualifications.filter((q) => q.agentId === agentId);
    const total = agentQuals.length;
    const interested = agentQuals.filter((q) => q.category === "interested").length;
    const notInterested = agentQuals.filter((q) => q.category === "not_interested").length;
    const pending = agentQuals.filter((q) => q.category === "pending").length;
    byAgent[agentId] = {
      agentName: agentQuals[0]?.agentName || "Unknown Agent",
      total,
      interested,
      notInterested,
      pending,
      interestedPercent: total > 0 ? Math.round(interested / total * 100) : 0,
      notInterestedPercent: total > 0 ? Math.round(notInterested / total * 100) : 0,
      pendingPercent: total > 0 ? Math.round(pending / total * 100) : 0
    };
  }
  return {
    bySource,
    byCampaign,
    byAgent,
    overall: await getQualificationStats()
  };
}
export {
  analyzeMessage,
  createOrUpdateQualification,
  deleteQualification,
  getQualificationById,
  getQualificationByPhone,
  getQualificationReport,
  getQualificationStats,
  getQualifications,
  getQualificationsByAgent,
  getQualificationsByCampaign,
  getQualificationsByCategory,
  getQualificationsBySource,
  updateQualificationCategory,
  updateQualificationNotes
};
