import * as mongodb from "../storage/mongodb.adapter.js";
import { ConnectedAccount } from "../integrations/connectedAccount.model.js";
import { getDecryptedCredentials } from "../credentials/credentials.service.js";
const TEMPLATE_UNIT_PRICE = 0.85;
const STATUS_RANK = {
  pending: 0,
  sent: 2,
  accepted: 2,
  failed: 3,
  delivered: 4,
  read: 5
};
const normalizeStatus = (value) => {
  const status = String(value || "pending").toLowerCase();
  return status === "accepted" ? "sent" : status;
};
const strongerStatus = (left, right) => {
  const a = normalizeStatus(left);
  const b = normalizeStatus(right);
  return (STATUS_RANK[b] ?? 0) > (STATUS_RANK[a] ?? 0) ? b : a;
};
const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(-10);
const validDate = (value) => {
  if (value === null || value === void 0 || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const objectIdDate = (value) => {
  const raw = String(value || "");
  if (!/^[a-f\d]{24}$/i.test(raw)) return null;
  const seconds = Number.parseInt(raw.slice(0, 8), 16);
  const date = new Date(seconds * 1e3);
  return Number.isNaN(date.getTime()) ? null : date;
};
const webhookFailureReason = (event) => [
  event?.errorTitle,
  event?.errorMessage,
  event?.errorDetails,
  event?.rawStatus?.errors?.[0]?.title,
  event?.rawStatus?.errors?.[0]?.message,
  event?.rawStatus?.errors?.[0]?.error_data?.details
].map((value) => String(value || "").trim()).filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(" - ");
function buildUsageDateMatch(options = {}) {
  const from = options.fromDate ? validDate(`${options.fromDate}T00:00:00.000`) : null;
  const to = options.toDate ? validDate(`${options.toDate}T23:59:59.999`) : null;
  if (!from && !to) return {};
  const range = {};
  if (from) range.$gte = from.toISOString();
  if (to) range.$lte = to.toISOString();
  return range;
}
async function getTenantUsageEvents(userId, options = {}) {
  if (!userId) return [];
  const dateRange = buildUsageDateMatch(options);
  const hasDateRange = Object.keys(dateRange).length > 0;
  const maxRows = Math.min(Math.max(Number(options.limit) || 1e3, 100), 5e3);
  const [messages, contacts, broadcastLogs, campaignLogs, campaigns] = await Promise.all([
    mongodb.Message.find({ userId, ...hasDateRange ? { timestamp: dateRange } : {} }).sort({ timestamp: -1 }).limit(maxRows).lean(),
    mongodb.Contact.find({ userId }).select({ id: 1, name: 1, phone: 1 }).limit(1e4).lean(),
    mongodb.BroadcastLog.find({ userId, ...hasDateRange ? { timestamp: dateRange } : {} }).sort({ timestamp: -1 }).limit(maxRows).lean(),
    mongodb.CampaignLog.find(
      hasDateRange ? {
        userId,
        $or: [
          { sentAt: dateRange },
          { sendAttemptedAt: dateRange },
          { createdAt: dateRange }
        ]
      } : { userId }
    ).sort({ createdAt: -1 }).limit(maxRows).lean(),
    mongodb.Campaign.find({ userId }).select({ _id: 1, name: 1 }).lean()
  ]);
  const contactsById = new Map(
    contacts.map((contact) => [String(contact.id), contact])
  );
  const contactsByPhone = new Map(
    contacts.map((contact) => [normalizePhone(contact.phone), contact])
  );
  const campaignsById = new Map(
    campaigns.map((campaign) => [
      String(campaign._id),
      String(campaign.name || "Drip Campaign")
    ])
  );
  const ownedMessageIds = Array.from(
    new Set(
      [
        ...messages.map((item) => item.whatsappMessageId),
        ...broadcastLogs.map((item) => item.messageId),
        ...campaignLogs.map((item) => item.messageId)
      ].map((value) => String(value || "").trim()).filter(Boolean)
    )
  );
  const webhookEvents = ownedMessageIds.length ? await mongodb.WebhookStatusEvent.find({
    messageId: { $in: ownedMessageIds }
  }).sort({ statusTimestamp: 1, createdAt: 1 }).lean() : [];
  const connectedAccounts = await ConnectedAccount.find({
    userId,
    providerId: "whatsapp",
    status: "connected"
  }).select({ metadata: 1 }).lean();
  const decryptedCredentials = await getDecryptedCredentials(userId);
  const ownedPhoneNumberIds = Array.from(
    new Set(
      [
        decryptedCredentials?.phoneNumberId,
        ...connectedAccounts.map((account) => {
          const metadata = account?.metadata instanceof Map ? Object.fromEntries(account.metadata.entries()) : account?.metadata || {};
          return metadata.phoneNumberId;
        })
      ].map((value) => String(value || "").trim()).filter(Boolean)
    )
  );
  const accountWebhookEvents = await mongodb.WebhookStatusEvent.find({
    $and: [
      {
        $or: [
          { userId },
          ...ownedPhoneNumberIds.length ? [{ phoneNumberId: { $in: ownedPhoneNumberIds } }] : []
        ]
      },
      ...hasDateRange ? [
        {
          $or: [
            { statusTimestamp: dateRange },
            { webhookReceivedAt: dateRange },
            { createdAt: dateRange }
          ]
        }
      ] : []
    ]
  }).sort({ statusTimestamp: 1, createdAt: 1 }).limit(maxRows).lean();
  const webhookByMessageId = /* @__PURE__ */ new Map();
  for (const event of webhookEvents) {
    const messageId = String(event.messageId || "").trim();
    if (!messageId) continue;
    const current = webhookByMessageId.get(messageId) || {
      status: "pending",
      deliveredAt: null,
      readAt: null,
      failedAt: null
    };
    const status = normalizeStatus(event.status);
    current.status = strongerStatus(current.status, status);
    const eventTime = validDate(event.statusTimestamp)?.toISOString() || validDate(event.webhookReceivedAt)?.toISOString() || null;
    if (status === "delivered") current.deliveredAt = eventTime;
    if (status === "read") current.readAt = eventTime;
    if (status === "failed") {
      current.failedAt = eventTime;
      current.failureReason = webhookFailureReason(event) || current.failureReason;
      current.errorCode = event.errorCode || current.errorCode;
      current.errorTitle = event.errorTitle || current.errorTitle;
      current.errorMessage = event.errorMessage || current.errorMessage;
      current.errorDetails = event.errorDetails || current.errorDetails;
    }
    webhookByMessageId.set(messageId, current);
  }
  for (const event of accountWebhookEvents) {
    const messageId = String(event.messageId || "").trim();
    if (!messageId) continue;
    const current = webhookByMessageId.get(messageId) || {
      status: "pending",
      deliveredAt: null,
      readAt: null,
      failedAt: null,
      recipientId: String(event.recipientId || ""),
      pricingCategory: String(event.pricingCategory || "")
    };
    const status = normalizeStatus(event.status);
    current.status = strongerStatus(current.status, status);
    current.recipientId = current.recipientId || String(event.recipientId || "");
    current.pricingCategory = current.pricingCategory || String(event.pricingCategory || "");
    const eventTime = validDate(event.statusTimestamp)?.toISOString() || validDate(event.webhookReceivedAt)?.toISOString() || null;
    current.timestamp = current.timestamp || eventTime;
    if (status === "sent") current.sentAt = eventTime;
    if (status === "delivered") current.deliveredAt = eventTime;
    if (status === "read") current.readAt = eventTime;
    if (status === "failed") {
      current.failedAt = eventTime;
      current.failureReason = webhookFailureReason(event) || current.failureReason;
      current.errorCode = event.errorCode || current.errorCode;
      current.errorTitle = event.errorTitle || current.errorTitle;
      current.errorMessage = event.errorMessage || current.errorMessage;
      current.errorDetails = event.errorDetails || current.errorDetails;
    }
    webhookByMessageId.set(messageId, current);
  }
  const eventMap = /* @__PURE__ */ new Map();
  const addEvent = (candidate) => {
    const providerId = String(candidate.providerMessageId || "").trim();
    const key = providerId ? `provider:${providerId}` : `${candidate.source}:${candidate.id}`;
    const webhook = providerId ? webhookByMessageId.get(providerId) : null;
    const enriched = {
      ...candidate,
      status: strongerStatus(candidate.status, webhook?.status),
      deliveredAt: candidate.deliveredAt || webhook?.deliveredAt || null,
      readAt: candidate.readAt || webhook?.readAt || null,
      failedAt: candidate.failedAt || webhook?.failedAt || null,
      failureReason: candidate.failureReason || webhook?.failureReason || "",
      errorCode: candidate.errorCode || webhook?.errorCode || "",
      errorTitle: candidate.errorTitle || webhook?.errorTitle || "",
      errorMessage: candidate.errorMessage || webhook?.errorMessage || "",
      errorDetails: candidate.errorDetails || webhook?.errorDetails || ""
    };
    if (enriched.readAt) enriched.status = "read";
    else if (enriched.deliveredAt) enriched.status = strongerStatus(enriched.status, "delivered");
    else if (enriched.failedAt && STATUS_RANK[enriched.status] < STATUS_RANK.sent) {
      enriched.status = "failed";
    }
    const existing = eventMap.get(key);
    if (!existing) {
      eventMap.set(key, enriched);
      return;
    }
    eventMap.set(key, {
      ...existing,
      ...Object.fromEntries(
        Object.entries(enriched).filter(([, value]) => value !== void 0 && value !== "")
      ),
      contactId: existing.contactId || enriched.contactId,
      contactName: existing.contactName && existing.contactName !== "Unknown" ? existing.contactName : enriched.contactName,
      contactPhone: existing.contactPhone || enriched.contactPhone,
      source: existing.source && !["account_service", "account_marketing", "account_utility"].includes(
        existing.source
      ) ? existing.source : enriched.source,
      messageType: existing.messageType || enriched.messageType,
      templateName: existing.templateName || enriched.templateName,
      campaignName: existing.campaignName || enriched.campaignName,
      content: existing.content || enriched.content,
      status: strongerStatus(existing.status, enriched.status),
      deliveredAt: existing.deliveredAt || enriched.deliveredAt || null,
      readAt: existing.readAt || enriched.readAt || null,
      failedAt: existing.failedAt || enriched.failedAt || null,
      failureReason: existing.failureReason || enriched.failureReason || "",
      errorCode: existing.errorCode || enriched.errorCode || "",
      errorTitle: existing.errorTitle || enriched.errorTitle || "",
      errorMessage: existing.errorMessage || enriched.errorMessage || "",
      errorDetails: existing.errorDetails || enriched.errorDetails || ""
    });
  };
  for (const message of messages) {
    const contact = contactsById.get(String(message.contactId));
    addEvent({
      id: String(message.id || message._id),
      providerMessageId: message.whatsappMessageId || void 0,
      userId,
      contactId: String(message.contactId || ""),
      contactName: String(contact?.name || "Unknown"),
      contactPhone: String(contact?.phone || ""),
      direction: message.direction === "inbound" ? "inbound" : "outbound",
      source: message.source || "inbox",
      messageType: message.type === "template" ? "template" : "text",
      templateName: message.templateName || void 0,
      campaignName: message.campaignName || void 0,
      content: message.content || "",
      status: normalizeStatus(message.status),
      failureReason: message.failureReason || message.error || "",
      timestamp: validDate(message.timestamp)?.toISOString() || validDate(message.createdAt)?.toISOString() || (/* @__PURE__ */ new Date(0)).toISOString(),
      agentId: message.agentId || void 0
    });
  }
  for (const log of broadcastLogs) {
    const phone = String(log.contactPhone || "");
    const contact = contactsByPhone.get(normalizePhone(phone));
    addEvent({
      id: String(log.id || log._id),
      providerMessageId: log.messageId || void 0,
      userId,
      contactId: contact ? String(contact.id) : void 0,
      contactName: String(log.contactName || contact?.name || "Unknown"),
      contactPhone: phone || String(contact?.phone || ""),
      direction: "outbound",
      source: "broadcast",
      messageType: log.messageType || "custom",
      templateName: log.templateName || void 0,
      campaignName: log.campaignName || "Broadcast",
      content: log.message || "",
      status: normalizeStatus(log.status),
      failureReason: log.failureReason || log.error || "",
      timestamp: validDate(log.timestamp)?.toISOString() || validDate(log.createdAt)?.toISOString() || (/* @__PURE__ */ new Date(0)).toISOString(),
      replied: Boolean(log.replied)
    });
  }
  for (const log of campaignLogs) {
    const phone = String(log.contact || "");
    const contact = contactsByPhone.get(normalizePhone(phone));
    addEvent({
      id: String(log._id),
      providerMessageId: log.messageId || void 0,
      userId,
      contactId: contact ? String(contact.id) : void 0,
      contactName: String(contact?.name || phone || "Unknown"),
      contactPhone: phone || String(contact?.phone || ""),
      direction: "outbound",
      source: "drip",
      messageType: "template",
      templateName: log.templateName || "Unknown template",
      campaignName: campaignsById.get(String(log.campaignId)) || "Drip Campaign",
      status: normalizeStatus(log.status),
      failureReason: log.failureReason || log.error || "",
      timestamp: validDate(log.sentAt)?.toISOString() || validDate(log.sendAttemptedAt)?.toISOString() || validDate(log.createdAt)?.toISOString() || objectIdDate(log._id)?.toISOString() || (/* @__PURE__ */ new Date(0)).toISOString(),
      deliveredAt: validDate(log.deliveredAt)?.toISOString() || null,
      readAt: validDate(log.readAt)?.toISOString() || null,
      failedAt: validDate(log.failedAt)?.toISOString() || null
    });
  }
  for (const [messageId, webhook] of webhookByMessageId.entries()) {
    const pricingCategory = String(webhook.pricingCategory || "").toLowerCase();
    const source = pricingCategory === "authentication" ? "otp" : pricingCategory === "utility" ? "voice_marketing" : pricingCategory === "marketing" ? "account_marketing" : "account_service";
    const templateName = pricingCategory === "authentication" ? "Authentication OTP" : pricingCategory === "utility" ? "Voice Marketing Utility Template" : pricingCategory === "marketing" ? "Account Marketing Template" : void 0;
    addEvent({
      id: `webhook:${messageId}`,
      providerMessageId: messageId,
      userId,
      contactName: String(webhook.recipientId || "Unknown"),
      contactPhone: String(webhook.recipientId || ""),
      direction: "outbound",
      source,
      messageType: ["authentication", "utility", "marketing"].includes(pricingCategory) ? "template" : "text",
      templateName,
      campaignName: pricingCategory === "authentication" ? "Platform OTP" : pricingCategory === "utility" ? "Voice Marketing / Utility" : "Account-wide WhatsApp",
      status: webhook.status,
      timestamp: webhook.sentAt || webhook.timestamp || webhook.deliveredAt || webhook.readAt || (/* @__PURE__ */ new Date(0)).toISOString(),
      deliveredAt: webhook.deliveredAt || null,
      readAt: webhook.readAt || null,
      failedAt: webhook.failedAt || null
    });
  }
  return Array.from(eventMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
function applyUsageFilters(events, query) {
  const from = query.fromDate ? /* @__PURE__ */ new Date(`${query.fromDate}T00:00:00.000`) : null;
  const to = query.toDate ? /* @__PURE__ */ new Date(`${query.toDate}T23:59:59.999`) : null;
  const search = String(query.search || "").trim().toLowerCase();
  const status = String(query.status || "all").toLowerCase();
  const direction = String(query.direction || "all").toLowerCase();
  const source = String(query.source || "all").toLowerCase();
  const template = String(query.template || "all").toLowerCase();
  return events.filter((event) => {
    const timestamp = new Date(event.timestamp);
    if (from && timestamp < from) return false;
    if (to && timestamp > to) return false;
    if (status !== "all" && event.status !== status) return false;
    if (direction !== "all" && event.direction !== direction) return false;
    if (source !== "all" && event.source !== source) return false;
    if (template !== "all" && String(event.templateName || "").toLowerCase() !== template) {
      return false;
    }
    if (search) {
      const haystack = [
        event.contactName,
        event.contactPhone,
        event.templateName,
        event.campaignName,
        event.content,
        event.providerMessageId
      ].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}
function buildUsageResponse(events, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(query.limit) || 25));
  const total = events.length;
  const rows = events.slice((page - 1) * limit, page * limit);
  const byRecipientMap = /* @__PURE__ */ new Map();
  const byTemplateMap = /* @__PURE__ */ new Map();
  const timelineMap = /* @__PURE__ */ new Map();
  for (const event of events) {
    const recipientKey = normalizePhone(event.contactPhone) || event.contactName;
    const recipient = byRecipientMap.get(recipientKey) || {
      contactName: event.contactName,
      contactPhone: event.contactPhone,
      total: 0,
      inbound: 0,
      outbound: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      cost: 0
    };
    recipient.total++;
    recipient[event.direction]++;
    if (["delivered", "read"].includes(event.status)) recipient.delivered++;
    if (event.status === "read") recipient.read++;
    if (event.status === "failed") recipient.failed++;
    if (event.messageType === "template" && event.direction === "outbound" && event.status !== "failed" && event.status !== "pending") {
      recipient.cost += TEMPLATE_UNIT_PRICE;
    }
    byRecipientMap.set(recipientKey, recipient);
    if (event.messageType === "template") {
      const templateKey = event.templateName || "Unknown template";
      const template = byTemplateMap.get(templateKey) || {
        templateName: templateKey,
        total: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        chargeable: 0,
        cost: 0
      };
      template.total++;
      if (["delivered", "read"].includes(event.status)) template.delivered++;
      if (event.status === "read") template.read++;
      if (event.status === "failed") template.failed++;
      if (event.status !== "failed" && event.status !== "pending") {
        template.chargeable++;
        template.cost += TEMPLATE_UNIT_PRICE;
      }
      byTemplateMap.set(templateKey, template);
    }
    const dateKey = event.timestamp.slice(0, 10);
    const point = timelineMap.get(dateKey) || {
      date: dateKey,
      total: 0,
      inbound: 0,
      outbound: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      templates: 0,
      cost: 0
    };
    point.total++;
    point[event.direction]++;
    if (["delivered", "read"].includes(event.status)) point.delivered++;
    if (event.status === "read") point.read++;
    if (event.status === "failed") point.failed++;
    if (event.messageType === "template") {
      point.templates++;
      if (event.status !== "failed" && event.status !== "pending") {
        point.cost += TEMPLATE_UNIT_PRICE;
      }
    }
    timelineMap.set(dateKey, point);
  }
  const outbound = events.filter((event) => event.direction === "outbound");
  const delivered = outbound.filter(
    (event) => ["delivered", "read"].includes(event.status)
  ).length;
  const read = outbound.filter((event) => event.status === "read").length;
  const failed = outbound.filter((event) => event.status === "failed").length;
  const templateEvents = events.filter((event) => event.messageType === "template");
  const chargeableTemplates = templateEvents.filter(
    (event) => event.direction === "outbound" && event.status !== "failed" && event.status !== "pending"
  ).length;
  return {
    summary: {
      totalMessages: total,
      outbound: outbound.length,
      inbound: events.filter((event) => event.direction === "inbound").length,
      delivered,
      read,
      failed,
      deliveryRate: outbound.length ? Math.round(delivered / outbound.length * 100) : 0,
      readRate: delivered ? Math.round(read / delivered * 100) : 0,
      uniqueRecipients: byRecipientMap.size,
      templateMessages: templateEvents.length,
      chargeableTemplates,
      unitPrice: TEMPLATE_UNIT_PRICE,
      totalCost: Number((chargeableTemplates * TEMPLATE_UNIT_PRICE).toFixed(2))
    },
    filters: {
      templates: Array.from(byTemplateMap.keys()).sort(),
      sources: Array.from(new Set(events.map((event) => event.source))).sort()
    },
    byRecipient: Array.from(byRecipientMap.values()).map((item) => ({ ...item, cost: Number(item.cost.toFixed(2)) })).sort((a, b) => b.total - a.total),
    byTemplate: Array.from(byTemplateMap.values()).map((item) => ({ ...item, cost: Number(item.cost.toFixed(2)) })).sort((a, b) => b.total - a.total),
    timeline: Array.from(timelineMap.values()).map((item) => ({ ...item, cost: Number(item.cost.toFixed(2)) })).sort((a, b) => a.date.localeCompare(b.date)),
    rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}
export {
  TEMPLATE_UNIT_PRICE,
  applyUsageFilters,
  buildUsageResponse,
  getTenantUsageEvents
};
