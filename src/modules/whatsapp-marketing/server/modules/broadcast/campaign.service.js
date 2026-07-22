import { Campaign } from "./campaign.model.js";
import * as aiService from "../ai/ai.service.js";
import * as agentService from "../aiAgents/agent.service.js";
import * as whatsappService from "../whatsapp/whatsapp.service.js";
import { Contact } from "../storage/mongodb.adapter.js";
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) {
    return cleaned;
  }
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
    return cleaned;
  }
  const commonCountryCodes = ["1", "44", "91", "92", "93", "94", "971", "966", "965", "974", "20", "27", "61", "64", "81", "86", "62"];
  for (const code of commonCountryCodes) {
    if (cleaned.startsWith(code) && cleaned.length >= 10) {
      return cleaned;
    }
  }
  if (cleaned.startsWith("0")) {
    cleaned = "91" + cleaned.substring(1);
  }
  return cleaned;
}
async function getAllContacts(userId) {
  const contacts = await Contact.find({}).lean();
  return contacts.map((c) => ({
    ...c,
    id: c._id.toString()
  }));
}
async function getAvailableContacts(userId) {
  const allContacts = await Contact.find({}).lean();
  const activeCampaigns = await Campaign.find({
    userId,
    status: { $in: ["draft", "scheduled", "sending", "completed"] }
  }).lean();
  const usedPhones = /* @__PURE__ */ new Set();
  for (const campaign of activeCampaigns) {
    for (const contact of campaign.contacts) {
      usedPhones.add(contact.phone.replace(/\D/g, ""));
    }
  }
  return allContacts.filter((c) => {
    const normalizedPhone = c.phone.replace(/\D/g, "");
    return !usedPhones.has(normalizedPhone);
  }).map((c) => ({
    ...c,
    id: c._id.toString()
  }));
}
async function createCampaign(userId, data) {
  const contacts = await Contact.find({ _id: { $in: data.contactIds } }).lean();
  const campaignContacts = contacts.map((c) => ({
    contactId: c._id.toString(),
    phone: c.phone,
    name: c.name,
    status: "pending",
    replied: false,
    interestStatus: "pending"
  }));
  const campaign = await Campaign.create({
    userId,
    name: data.name,
    description: data.description,
    messageType: data.messageType,
    templateName: data.templateName,
    customMessage: data.customMessage,
    agentId: data.agentId,
    contacts: campaignContacts,
    status: data.scheduledAt ? "scheduled" : "draft",
    scheduledAt: data.scheduledAt,
    metrics: {
      totalContacts: campaignContacts.length,
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      failed: 0,
      interested: 0,
      notInterested: 0,
      neutral: 0
    }
  });
  console.log(`[Campaign] Created campaign "${data.name}" with ${campaignContacts.length} contacts`);
  return campaign;
}
async function getCampaigns(userId, filters) {
  const query = { userId };
  if (filters?.status) {
    query.status = filters.status;
  }
  const total = await Campaign.countDocuments(query);
  let campaignsQuery = Campaign.find(query).sort({ createdAt: -1 });
  if (filters?.offset) {
    campaignsQuery = campaignsQuery.skip(filters.offset);
  }
  if (filters?.limit) {
    campaignsQuery = campaignsQuery.limit(filters.limit);
  }
  const campaigns = await campaignsQuery.lean();
  return { campaigns, total };
}
async function getCampaignById(userId, campaignId) {
  const campaign = await Campaign.findOne({ _id: campaignId, userId }).lean();
  return campaign;
}
async function executeCampaign(userId, campaignId) {
  const campaign = await Campaign.findOne({ _id: campaignId, userId });
  if (!campaign) {
    throw new Error("Campaign not found");
  }
  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    throw new Error("Campaign is not in a sendable state");
  }
  campaign.status = "sending";
  campaign.startedAt = /* @__PURE__ */ new Date();
  await campaign.save();
  console.log(`[Campaign] Starting execution of "${campaign.name}" to ${campaign.contacts.length} contacts`);
  const credentials = await whatsappService.getWhatsAppCredentialsStrict(userId);
  if (!credentials) {
    campaign.status = "cancelled";
    await campaign.save();
    throw new Error("WhatsApp credentials not configured");
  }
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < campaign.contacts.length; i++) {
    const contact = campaign.contacts[i];
    try {
      let result;
      switch (campaign.messageType) {
        case "template":
          result = await sendTemplateMessage(
            contact.phone,
            campaign.templateName || "hello_world",
            contact.name,
            userId
          );
          break;
        case "custom":
          result = await sendCustomMessage(
            contact.phone,
            campaign.customMessage || "",
            userId
          );
          break;
        case "ai_agent":
          result = await sendAIAgentMessage(
            contact.phone,
            campaign.agentId || "",
            contact.name,
            userId
          );
          break;
        default:
          result = { success: false, error: "Invalid message type" };
      }
      if (result.success) {
        campaign.contacts[i].status = "sent";
        campaign.contacts[i].messageId = result.messageId;
        campaign.contacts[i].sentAt = /* @__PURE__ */ new Date();
        sent++;
      } else {
        campaign.contacts[i].status = "failed";
        campaign.contacts[i].error = result.error;
        failed++;
      }
    } catch (error) {
      campaign.contacts[i].status = "failed";
      campaign.contacts[i].error = error.message;
      failed++;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  campaign.metrics.sent = sent;
  campaign.metrics.failed = failed;
  campaign.status = "completed";
  campaign.completedAt = /* @__PURE__ */ new Date();
  await campaign.save();
  console.log(`[Campaign] Completed "${campaign.name}": ${sent} sent, ${failed} failed`);
  return campaign;
}
async function updateCampaignContactStatus(messageId, status, timestamp, failureReason) {
  const updateField = status === "delivered" ? "deliveredAt" : status === "read" ? "readAt" : "failedAt";
  const metricsField = status === "delivered" ? "metrics.delivered" : status === "read" ? "metrics.read" : "metrics.failed";
  const result = await Campaign.updateOne(
    { "contacts.messageId": messageId, [`contacts.${updateField}`]: { $exists: false } },
    {
      $set: {
        [`contacts.$.status`]: status,
        [`contacts.$.${updateField}`]: timestamp || /* @__PURE__ */ new Date(),
        ...status === "failed" && failureReason ? { "contacts.$.error": failureReason } : {}
      },
      $inc: { [metricsField]: 1 }
    }
  );
  return result.modifiedCount > 0;
}
async function markCampaignContactAsReplied(phone, replyText, interestStatus) {
  const normalizedPhone = phone.replace(/\D/g, "");
  const campaigns = await Campaign.find({
    status: "completed",
    "contacts.replied": false
  });
  let updated = false;
  for (const campaign of campaigns) {
    for (let i = 0; i < campaign.contacts.length; i++) {
      const contactPhone = campaign.contacts[i].phone.replace(/\D/g, "");
      const last10 = normalizedPhone.slice(-10);
      const contactLast10 = contactPhone.slice(-10);
      if (last10 === contactLast10 && !campaign.contacts[i].replied) {
        campaign.contacts[i].replied = true;
        campaign.contacts[i].repliedAt = /* @__PURE__ */ new Date();
        campaign.contacts[i].replyText = replyText;
        if (interestStatus) {
          const oldInterest = campaign.contacts[i].interestStatus;
          campaign.contacts[i].interestStatus = interestStatus;
          if (oldInterest !== "interested" && interestStatus === "interested") {
            campaign.metrics.interested++;
          }
          if (oldInterest !== "not_interested" && interestStatus === "not_interested") {
            campaign.metrics.notInterested++;
          }
          if (oldInterest !== "neutral" && interestStatus === "neutral") {
            campaign.metrics.neutral++;
          }
        }
        campaign.metrics.replied++;
        await campaign.save();
        updated = true;
        console.log(`[Campaign] Marked contact ${phone} as replied in campaign "${campaign.name}"`);
      }
    }
  }
  return updated;
}
async function getInterestedContacts(userId, campaignId) {
  const campaign = await Campaign.findOne({ _id: campaignId, userId }).lean();
  if (!campaign) return [];
  return campaign.contacts.filter((c) => c.interestStatus === "interested");
}
async function getNotInterestedContacts(userId, campaignId) {
  const campaign = await Campaign.findOne({ _id: campaignId, userId }).lean();
  if (!campaign) return [];
  return campaign.contacts.filter((c) => c.interestStatus === "not_interested");
}
async function sendToInterestList(userId, campaignId, interestType, messageConfig) {
  const sourceCampaign = await Campaign.findOne({ _id: campaignId, userId }).lean();
  if (!sourceCampaign) {
    throw new Error("Source campaign not found");
  }
  const targetContacts = sourceCampaign.contacts.filter((c) => c.interestStatus === interestType);
  if (targetContacts.length === 0) {
    throw new Error(`No ${interestType.replace("_", " ")} contacts found in this campaign`);
  }
  const newCampaign = await Campaign.create({
    userId,
    name: messageConfig.campaignName || `Follow-up: ${interestType.replace("_", " ")} from "${sourceCampaign.name}"`,
    description: `Re-targeting ${interestType.replace("_", " ")} contacts from campaign "${sourceCampaign.name}"`,
    messageType: messageConfig.messageType,
    templateName: messageConfig.templateName,
    agentId: messageConfig.agentId,
    contacts: targetContacts.map((c) => ({
      contactId: c.contactId,
      phone: c.phone,
      name: c.name,
      status: "pending",
      replied: false,
      interestStatus: "pending"
    })),
    status: "draft",
    metrics: {
      totalContacts: targetContacts.length,
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      failed: 0,
      interested: 0,
      notInterested: 0,
      neutral: 0
    }
  });
  return executeCampaign(userId, newCampaign._id.toString());
}
async function deleteCampaign(userId, campaignId) {
  const result = await Campaign.deleteOne({ _id: campaignId, userId });
  return result.deletedCount > 0;
}
async function sendTemplateMessage(phone, templateName, contactName, userId) {
  const components = [];
  if (templateName.includes("awards") || templateName.includes("marketing")) {
    components.push({
      type: "body",
      parameters: [{ type: "text", text: contactName || "Valued Customer", parameter_name: "name" }]
    });
  }
  const result = await whatsappService.sendTemplateMessage(
    formatPhoneNumber(phone),
    templateName,
    "en",
    components,
    userId
  );
  return result;
}
async function sendCustomMessage(phone, message, userId) {
  return whatsappService.sendTextMessage(formatPhoneNumber(phone), message, userId);
}
async function sendAIAgentMessage(phone, agentId, contactName, userId) {
  const agent = await agentService.getAgentById(agentId);
  if (!agent) {
    return { success: false, error: "Agent not found" };
  }
  const prompt = `Contact name: ${contactName}. Generate a friendly personalized outreach message. Keep it under 160 characters.`;
  const aiMessage = await aiService.generateAgentResponse(prompt, agent, []);
  if (!aiMessage) {
    return { success: false, error: "Failed to generate AI message" };
  }
  const customResult = await sendCustomMessage(phone, aiMessage, userId);
  if (!customResult.success && (customResult.error?.includes("24") || customResult.error?.includes("window"))) {
    return await sendTemplateMessage(
      formatPhoneNumber(phone),
      "hello_world",
      void 0,
      userId
    );
  }
  return customResult;
}
export {
  createCampaign,
  deleteCampaign,
  executeCampaign,
  getAllContacts,
  getAvailableContacts,
  getCampaignById,
  getCampaigns,
  getInterestedContacts,
  getNotInterestedContacts,
  markCampaignContactAsReplied,
  sendToInterestList,
  updateCampaignContactStatus
};
