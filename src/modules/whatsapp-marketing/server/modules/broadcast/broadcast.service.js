import * as mongodb from "../storage/mongodb.adapter.js";
import * as aiService from "../ai/ai.service.js";
import * as agentService from "../aiAgents/agent.service.js";
import * as whatsappService from "../whatsapp/whatsapp.service.js";
import { storage } from "../../storage.js";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
function getWhatsAppCredentials() {
  const token = "";
  const phoneNumberId = "";
  if (!token || !phoneNumberId) {
    return null;
  }
  return { token, phoneNumberId };
}
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) {
    return cleaned;
  }
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
    return cleaned;
  }
  const commonCountryCodes = [
    "1",
    "44",
    "91",
    "92",
    "93",
    "94",
    "971",
    "966",
    "965",
    "974",
    "20",
    "27",
    "61",
    "64",
    "81",
    "86",
    "62"
  ];
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
async function getBroadcastLists() {
  return mongodb.readCollection("broadcast_lists");
}
async function getBroadcastListById(id) {
  const result = await mongodb.findOne("broadcast_lists", {
    id
  });
  return result || void 0;
}
async function createBroadcastList(name, contacts) {
  const newList = {
    id: `list-${Date.now()}`,
    name,
    contacts,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await mongodb.insertOne("broadcast_lists", newList);
  return newList;
}
async function updateBroadcastList(id, name, contacts) {
  const existing = await getBroadcastListById(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    name,
    contacts,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await mongodb.updateOne("broadcast_lists", { id }, updated);
  return updated;
}
async function deleteBroadcastList(id) {
  return mongodb.deleteOne("broadcast_lists", { id });
}
async function getScheduledMessages() {
  return mongodb.readCollection("scheduled_messages");
}
async function createScheduledMessage(data) {
  const newMessage = {
    ...data,
    id: `schedule-${Date.now()}`,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    sentCount: 0,
    failedCount: 0
  };
  await mongodb.insertOne("scheduled_messages", newMessage);
  return newMessage;
}
async function updateScheduledMessage(id, updates) {
  const existing = await mongodb.findOne(
    "scheduled_messages",
    { id }
  );
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  await mongodb.updateOne("scheduled_messages", { id }, updated);
  return updated;
}
async function deleteScheduledMessage(id) {
  return mongodb.deleteOne("scheduled_messages", { id });
}
function isHttpUrl(value) {
  return Boolean(value && /^https?:\/\//i.test(value));
}
const MEDIA_ID_CACHE_TTL_MS = Number(
  process.env.WHATSAPP_MEDIA_ID_CACHE_TTL_MS || 6 * 60 * 60 * 1e3
);
const mediaIdCache = /* @__PURE__ */ new Map();
const mediaIdUploadInFlight = /* @__PURE__ */ new Map();
function isMediaWeblinkFailure(error) {
  if (!error) return false;
  return /131053|media upload error|weblink failed|http code 403|forbidden/i.test(
    error
  );
}
function getMediaCacheKey(mediaType, mediaUrl) {
  return `${mediaType}:${String(mediaUrl || "").trim()}`;
}
async function uploadMediaFromUrlToMeta(mediaUrl, mediaType) {
  const credentials = getWhatsAppCredentials();
  if (!credentials) return null;
  try {
    const sourceResponse = await fetch(mediaUrl);
    if (!sourceResponse.ok) {
      console.error(
        `[SendTemplate] Failed to download media for re-upload: ${sourceResponse.status} ${sourceResponse.statusText}`
      );
      return null;
    }
    const mediaBuffer = await sourceResponse.arrayBuffer();
    const contentTypeHeader = sourceResponse.headers.get("content-type") || "";
    const fallbackMime = mediaType === "video" ? "video/mp4" : mediaType === "document" ? "application/pdf" : "image/jpeg";
    const mimeType = contentTypeHeader.split(";")[0].trim() || fallbackMime;
    const extension = mediaType === "video" ? "mp4" : mediaType === "document" ? "pdf" : "jpg";
    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");
    formData.append(
      "file",
      new Blob([mediaBuffer], { type: mimeType }),
      `template-header-${Date.now()}.${extension}`
    );
    const uploadResponse = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.token}`
        },
        body: formData
      }
    );
    const uploadText = await uploadResponse.text();
    let uploadData = {};
    try {
      uploadData = uploadText ? JSON.parse(uploadText) : {};
    } catch {
      uploadData = { raw: uploadText };
    }
    if (uploadResponse.ok && uploadData?.id) {
      console.log(
        `[SendTemplate] Media uploaded to Meta successfully | mediaId=${uploadData.id}`
      );
      return String(uploadData.id);
    }
    console.error(
      `[SendTemplate] Media upload to Meta failed:`,
      JSON.stringify(uploadData)
    );
    return null;
  } catch (error) {
    console.error("[SendTemplate] Media upload fallback failed:", error);
    return null;
  }
}
async function getOrUploadMediaId(mediaUrl, mediaType) {
  const cacheKey = getMediaCacheKey(mediaType, mediaUrl);
  const now = Date.now();
  const cached = mediaIdCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.mediaId;
  }
  if (cached && cached.expiresAt <= now) {
    mediaIdCache.delete(cacheKey);
  }
  const inFlight = mediaIdUploadInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }
  const uploadPromise = (async () => {
    const mediaId = await uploadMediaFromUrlToMeta(mediaUrl, mediaType);
    if (mediaId) {
      mediaIdCache.set(cacheKey, {
        mediaId,
        expiresAt: now + Math.max(MEDIA_ID_CACHE_TTL_MS, 6e4)
      });
    }
    return mediaId;
  })();
  mediaIdUploadInFlight.set(cacheKey, uploadPromise);
  try {
    return await uploadPromise;
  } finally {
    mediaIdUploadInFlight.delete(cacheKey);
  }
}
function extractHeaderMediaLink(components, mediaType) {
  for (const component of components) {
    if (component.type !== "header" || !Array.isArray(component.parameters)) {
      continue;
    }
    for (const param of component.parameters) {
      if (param?.type !== mediaType) continue;
      if (mediaType === "image" && isHttpUrl(param?.image?.link)) {
        return String(param.image.link);
      }
      if (mediaType === "video" && isHttpUrl(param?.video?.link)) {
        return String(param.video.link);
      }
      if (mediaType === "document" && isHttpUrl(param?.document?.link)) {
        return String(param.document.link);
      }
    }
  }
  return void 0;
}
function replaceHeaderMediaLinkWithId(components, mediaType, mediaId) {
  return components.map((component) => {
    if (component.type !== "header" || !Array.isArray(component.parameters)) {
      return component;
    }
    const newParameters = component.parameters.map((param) => {
      if (param?.type !== mediaType) return param;
      if (mediaType === "video") {
        return { type: "video", video: { id: mediaId } };
      }
      if (mediaType === "document") {
        return { type: "document", document: { id: mediaId, filename: "template-header" } };
      }
      return { type: "image", image: { id: mediaId } };
    });
    return {
      ...component,
      parameters: newParameters
    };
  });
}
function extractPlaceholderTokens(text) {
  if (!text) return [];
  const matches = [...text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)];
  const tokens = [];
  for (const match of matches) {
    const token = (match[1] || "").trim();
    if (!token) continue;
    tokens.push(token);
  }
  return tokens;
}
function resolveTemplateValue(token, index, values) {
  const fallbackName = values.name?.trim() || "Customer";
  const fallbackPhone = values.phone?.trim() || fallbackName;
  const fallbackEmail = values.email?.trim() || fallbackName;
  if (/^\d+$/.test(token)) {
    const position = Number(token);
    if (position === 1) return fallbackName;
    if (position === 2) return fallbackPhone;
    if (position === 3) return fallbackEmail;
    return fallbackName;
  }
  const lowered = token.toLowerCase();
  if (lowered.includes("name")) return fallbackName;
  if (lowered.includes("phone") || lowered.includes("mobile")) return fallbackPhone;
  if (lowered.includes("email")) return fallbackEmail;
  if (index === 1) return fallbackName;
  if (index === 2) return fallbackPhone;
  if (index === 3) return fallbackEmail;
  return fallbackName;
}
function buildTextParameters(text, values) {
  const tokens = extractPlaceholderTokens(text);
  return tokens.map((token, index) => ({
    type: "text",
    text: resolveTemplateValue(token, index + 1, values)
  }));
}
function buildTemplateComponents(templateRecord, values) {
  if (!templateRecord) return [];
  const components = [];
  const headerType = String(templateRecord.headerType || "").toLowerCase();
  if (headerType === "image" || headerType === "video" || headerType === "document") {
    const mediaLink = isHttpUrl(templateRecord.previewUrl) ? templateRecord.previewUrl : isHttpUrl(templateRecord.headerImageUrl) ? templateRecord.headerImageUrl : void 0;
    if (mediaLink) {
      const mediaParameter = headerType === "video" ? { type: "video", video: { link: mediaLink } } : headerType === "document" ? {
        type: "document",
        document: { link: mediaLink, filename: "template-header" }
      } : { type: "image", image: { link: mediaLink } };
      components.push({
        type: "header",
        parameters: [mediaParameter]
      });
    }
  }
  const headerParameters = buildTextParameters(templateRecord.headerText, values);
  if (headerType !== "image" && headerType !== "video" && headerType !== "document" && headerParameters.length > 0) {
    components.push({ type: "header", parameters: headerParameters });
  }
  const bodyParameters = buildTextParameters(templateRecord.content, values);
  if (bodyParameters.length > 0) {
    components.push({ type: "body", parameters: bodyParameters });
  }
  templateRecord.buttons?.forEach((button, index) => {
    if (button?.type !== "url") return;
    const buttonParameters = buildTextParameters(button.url, values);
    if (buttonParameters.length === 0) return;
    components.push({
      type: "button",
      sub_type: "url",
      index: String(index),
      parameters: buttonParameters
    });
  });
  return components;
}
function withSendMetadata(result, templateName, phone) {
  return {
    success: result.success,
    messageId: result.messageId,
    error: result.error,
    error_code: result.success ? null : result.errorCode ?? "template_send_failed",
    template_name: templateName,
    phone_number: result.acceptedRecipient || phone,
    provider_status: result.messageStatus || null,
    provider_http_status: typeof result.providerHttpStatus === "number" ? result.providerHttpStatus : null,
    provider_response: result.providerResponse || null,
    request_payload: result.requestPayload || null,
    attempted_language: result.attemptedLanguage || null,
    provider_error_code: result.errorCode ?? null
  };
}
async function sendTemplateMessage(phone, templateName, contactName, options, userId) {
  const formattedPhone = formatPhoneNumber(phone);
  const normalizedTemplateName = templateName.toLowerCase().replace(/\s+/g, "_");
  const templateRecord = await mongodb.Template.findOne({
    userId,
    $or: [
      { id: templateName },
      { id: normalizedTemplateName },
      { name: templateName },
      { name: normalizedTemplateName }
    ]
  }).lean();
  const resolvedTemplateName = templateRecord?.name || templateName;
  const languageCode = templateRecord?.language || "en_US";
  const normalizedHeaderType = String(templateRecord?.headerType || "").toLowerCase();
  const allowLanguageFallback = options?.allowLanguageFallback !== false;
  const mediaHeaderTypes = ["image", "video", "document"];
  const currentMediaHeaderType = mediaHeaderTypes.find(
    (type) => type === normalizedHeaderType
  );
  if ((normalizedHeaderType === "image" || normalizedHeaderType === "video" || normalizedHeaderType === "document") && !isHttpUrl(templateRecord?.previewUrl) && !isHttpUrl(templateRecord?.headerImageUrl)) {
    return withSendMetadata(
      {
        success: false,
        error: "Template has media header but no usable media URL. Configure Cloudinary and re-upload header media in Templates."
      },
      resolvedTemplateName,
      formattedPhone
    );
  }
  const components = buildTemplateComponents(templateRecord, {
    name: contactName,
    phone: formattedPhone
  });
  let componentsForSend = components;
  if (currentMediaHeaderType) {
    const mediaLink = extractHeaderMediaLink(components, currentMediaHeaderType);
    if (mediaLink) {
      const mediaId = await getOrUploadMediaId(mediaLink, currentMediaHeaderType);
      if (mediaId) {
        componentsForSend = replaceHeaderMediaLinkWithId(
          components,
          currentMediaHeaderType,
          mediaId
        );
        console.log(
          `[SendTemplate] Using uploaded media ID for "${resolvedTemplateName}" (${currentMediaHeaderType})`
        );
      }
    }
  }
  console.log(
    `[SendTemplate] Sending "${resolvedTemplateName}" with ${componentsForSend.length} component(s)`
  );
  let result = await whatsappService.sendTemplateMessage(
    formattedPhone,
    resolvedTemplateName,
    languageCode,
    componentsForSend,
    userId
  );
  const parameterMismatch = Boolean(
    result.error && /132000|132012|parameter format does not match|parameters does not match|localizable_params|expected number of params/i.test(
      result.error
    )
  );
  if (!result.success && parameterMismatch && componentsForSend.length === 0) {
    const expectedMatch = result.error?.match(/expected number of params\s*\((\d+)\)/i);
    const parsedCount = expectedMatch ? Number(expectedMatch[1]) : 1;
    const safeCount = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 1;
    const fallbackComponents = [
      {
        type: "body",
        parameters: Array.from({ length: safeCount }, () => ({
          type: "text",
          text: contactName || "Customer"
        }))
      }
    ];
    console.log(
      `[SendTemplate] Retrying "${resolvedTemplateName}" with ${safeCount} fallback parameter(s)`
    );
    result = await whatsappService.sendTemplateMessage(
      formattedPhone,
      resolvedTemplateName,
      languageCode,
      fallbackComponents,
      userId
    );
  }
  if (!result.success && currentMediaHeaderType && isMediaWeblinkFailure(result.error)) {
    const mediaLink = extractHeaderMediaLink(components, currentMediaHeaderType);
    if (mediaLink) {
      console.log(
        `[SendTemplate] Media link failed for "${resolvedTemplateName}". Retrying via uploaded media ID fallback.`
      );
      const mediaId = await getOrUploadMediaId(
        mediaLink,
        currentMediaHeaderType
      );
      if (mediaId) {
        const idComponents = replaceHeaderMediaLinkWithId(
          components,
          currentMediaHeaderType,
          mediaId
        );
        result = await whatsappService.sendTemplateMessage(
          formattedPhone,
          resolvedTemplateName,
          languageCode,
          idComponents,
          userId
        );
      }
    }
  }
  return withSendMetadata(result, resolvedTemplateName, formattedPhone);
}
async function sendCustomMessage(phone, message, userId) {
  const formattedPhone = formatPhoneNumber(phone);
  return whatsappService.sendTextMessage(formattedPhone, message, userId);
}
async function sendAIAgentMessage(phone, agentId, context, userId) {
  const agent = await agentService.getAgentById(agentId);
  if (!agent) {
    console.error(`[AIAgent] Agent not found: ${agentId}`);
    return { success: false, error: "Agent not found" };
  }
  const prompt = context || "Generate a friendly welcome message for a new contact. Keep it under 160 characters.";
  const aiMessage = await aiService.generateAgentResponse(prompt, agent, []);
  if (!aiMessage) {
    console.error("[AIAgent] Failed to generate AI message");
    return {
      success: false,
      error: "Failed to generate AI message. Check if API key is configured for the agent model."
    };
  }
  const customResult = await sendCustomMessage(phone, aiMessage, userId);
  if (!customResult.success && (customResult.error?.includes("24") || customResult.error?.includes("window"))) {
    return await sendTemplateMessage(
      formatPhoneNumber(phone),
      "hello_world",
      void 0,
      void 0,
      userId
    );
  }
  return customResult;
}
const SINGLE_MESSAGE_CAMPAIGN_NAME = "Single Message";
function normalizeWebhookBroadcastStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "accepted" || normalized === "sent") return "sent";
  if (normalized === "delivered") return "delivered";
  if (normalized === "read") return "read";
  if (normalized === "failed") return "failed";
  return null;
}
function getStatusRank(status) {
  switch (String(status || "").toLowerCase()) {
    case "failed":
      return 5;
    case "read":
      return 4;
    case "delivered":
      return 3;
    case "sent":
    case "accepted":
      return 2;
    case "pending":
      return 1;
    default:
      return 0;
  }
}
function getLatestWebhookEvent(events) {
  return events.reduce((latest, event) => {
    if (!latest) return event;
    const eventTime = new Date(event.statusTimestamp || event.webhookReceivedAt || event.createdAt || 0).getTime();
    const latestTime = new Date(latest.statusTimestamp || latest.webhookReceivedAt || latest.createdAt || 0).getTime();
    if (eventTime !== latestTime) return eventTime > latestTime ? event : latest;
    return getStatusRank(event.status) >= getStatusRank(latest.status) ? event : latest;
  }, null);
}
async function applyWebhookStatuses(logs) {
  const messageIds = Array.from(
    new Set(logs.map((log) => String(log.messageId || "").trim()).filter(Boolean))
  );
  if (messageIds.length === 0) return logs;
  const webhookEvents = (await mongodb.readCollection("webhook_status_events")).filter(
    (event) => messageIds.includes(String(event.messageId || "").trim())
  );
  const eventsByMessageId = /* @__PURE__ */ new Map();
  for (const event of webhookEvents) {
    const messageId = String(event.messageId || "").trim();
    if (!messageId) continue;
    const events = eventsByMessageId.get(messageId) || [];
    events.push(event);
    eventsByMessageId.set(messageId, events);
  }
  return logs.map((log) => {
    const latestEvent = getLatestWebhookEvent(eventsByMessageId.get(String(log.messageId || "").trim()) || []);
    const webhookStatus = normalizeWebhookBroadcastStatus(latestEvent?.status);
    if (!webhookStatus || getStatusRank(webhookStatus) < getStatusRank(log.status)) return log;
    return {
      ...log,
      status: webhookStatus,
      error: webhookStatus === "failed" ? latestEvent?.errorMessage || latestEvent?.errorTitle || latestEvent?.errorDetails || log.error : log.error
    };
  });
}
async function logBroadcastMessage(log) {
  const newLog = {
    ...log,
    id: `broadcast-log-${Date.now()}-${Math.random().toString(36).substring(7)}`
  };
  try {
    const result = await mongodb.insertOne("broadcast_logs", newLog);
    return result || newLog;
  } catch (error) {
    console.error("[BroadcastLog] Failed to save log:", error);
    return newLog;
  }
}
async function markBroadcastLogAsReplied(phone, userId) {
  try {
    const normalizedPhone = phone.replace(/\D/g, "");
    const logs = (await mongodb.readCollection("broadcast_logs")).filter((log) => log.userId === userId);
    let updatedCount = 0;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const log of logs) {
      const logPhone = log.contactPhone.replace(/\D/g, "");
      const last10Digits = normalizedPhone.slice(-10);
      const logLast10Digits = logPhone.slice(-10);
      const phoneMatches = last10Digits === logLast10Digits || logPhone.includes(normalizedPhone) || normalizedPhone.includes(logPhone);
      if (phoneMatches && !log.replied) {
        const updateResult = await mongodb.updateOne(
          "broadcast_logs",
          { id: log.id },
          {
            replied: true,
            repliedAt: now
          }
        );
        if (updateResult) {
          updatedCount++;
        } else {
        }
      }
    }
    return updatedCount;
  } catch (error) {
    console.error("[BroadcastLog] Error marking as replied:", error);
    return 0;
  }
}
async function updateBroadcastLogFromWebhook(messageId, status, error) {
  const normalizedStatus = normalizeWebhookBroadcastStatus(status);
  if (!messageId || !normalizedStatus) return;
  const update = {
    status: normalizedStatus
  };
  if (normalizedStatus === "failed" && error) {
    update.error = error;
  }
  await mongodb.updateOne(
    "broadcast_logs",
    { messageId },
    update
  );
}
async function getBroadcastLogs(filters) {
  try {
    let logs = await mongodb.readCollection("broadcast_logs");
    if (filters) {
      if (filters.userId) {
        logs = logs.filter((log) => log.userId === filters.userId);
      }
      if (filters.campaignName) {
        logs = logs.filter(
          (l) => l.campaignName.toLowerCase().includes(filters.campaignName.toLowerCase())
        );
      }
      if (filters.phone) {
        logs = logs.filter((l) => l.contactPhone.includes(filters.phone));
      }
    }
    logs = await applyWebhookStatuses(logs);
    if (filters?.status) {
      logs = logs.filter((l) => l.status === filters.status);
    }
    logs = logs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 100;
    return logs.slice(offset, offset + limit);
  } catch (error) {
    console.error("[BroadcastLogs] Failed to fetch logs:", error);
    return [];
  }
}
async function sendBroadcast(contacts, messageType, options) {
  const campaignName = options.campaignName || `Broadcast ${(/* @__PURE__ */ new Date()).toISOString()}`;
  if (options.isScheduled && options.scheduledTime) {
    const scheduledDate = new Date(options.scheduledTime);
    const scheduleData = {
      id: `scheduled-${Date.now()}`,
      userId: options.userId,
      contacts,
      messageType,
      templateName: options.templateName,
      customMessage: options.customMessage,
      agentId: options.agentId,
      campaignName,
      scheduledAt: scheduledDate.toISOString(),
      status: "scheduled",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await mongodb.insertOne("scheduled_broadcasts", scheduleData);
    return {
      total: contacts.length,
      successful: 0,
      failed: 0,
      results: [],
      scheduled: true,
      scheduledAt: scheduledDate.toISOString()
    };
  }
  const results = [];
  let successful = 0;
  let failed = 0;
  const credentials = await whatsappService.getWhatsAppCredentialsStrict(
    options.userId
  );
  if (!credentials) {
    console.error("[Broadcast] WhatsApp credentials not configured");
    return {
      total: contacts.length,
      successful: 0,
      failed: contacts.length,
      results: contacts.map((c) => ({
        phone: c.phone,
        success: false,
        error: "WhatsApp credentials not configured"
      })),
      credentialError: "WhatsApp API credentials (WHATSAPP_TOKEN and PHONE_NUMBER_ID) are not configured. Please add them in Settings > WhatsApp API."
    };
  }
  for (const contact of contacts) {
    let result;
    let messageContent = "";
    console.log(`[Broadcast] Sending to ${JSON.stringify(contact)}`);
    switch (messageType) {
      case "template":
        result = await sendTemplateMessage(
          contact.phone,
          options.templateName || "hello_world",
          contact.name,
          void 0,
          options.userId
        );
        messageContent = `[Template: ${options.templateName || "hello_world"}]`;
        break;
      case "custom":
        result = await sendCustomMessage(
          contact.phone,
          options.customMessage || "",
          options.userId
        );
        messageContent = options.customMessage || "";
        break;
      case "ai_agent":
        result = await sendAIAgentMessage(
          contact.phone,
          options.agentId || "",
          `Contact name: ${contact.name}`,
          options.userId
        );
        messageContent = "[AI Generated Message]";
        break;
      default:
        result = {
          success: false,
          error: "Invalid message type",
          error_code: null,
          template_name: null,
          phone_number: null
        };
        messageContent = "";
    }
    await logBroadcastMessage({
      userId: options.userId,
      campaignName,
      contactName: contact.name,
      contactPhone: contact.phone,
      messageType,
      templateName: options.templateName,
      message: messageContent,
      status: result.success ? "sent" : "failed",
      messageId: result.messageId,
      error: result.error,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    results.push({
      phone: contact.phone,
      success: result.success,
      error: result.error
    });
    if (result.success) {
      successful++;
      console.log(`[Broadcast] Sent to ${contact.name} (${contact.phone})`);
      try {
        if (!contact.phone) {
          console.warn("[Broadcast] No phone number, skipping inbox save");
          continue;
        }
        const contactdetail = await mongodb.Contact.findOne({
          userId: options.userId,
          phone: contact.phone
        });
        if (!contactdetail) {
          console.warn("[Broadcast] Contact not found in DB", {
            phone: contact.phone
          });
          continue;
        }
        await storage.createMessage({
          userId: options.userId,
          contactId: contactdetail.id,
          content: messageContent,
          type: "text",
          direction: "outbound",
          status: "sent",
          whatsappMessageId: result.messageId
        });
      } catch (saveError) {
        console.error(
          "[Broadcast] Failed to save message to conversation:",
          saveError
        );
      }
    } else {
      failed++;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return {
    total: contacts.length,
    successful,
    failed,
    results
  };
}
async function sendSingleMessage(phone, name, messageType, options, userId) {
  let messageContent = "";
  const result = await (async () => {
    switch (messageType) {
      case "template":
        messageContent = `[Template: ${options.templateName || "hello_world"}]`;
        return await sendTemplateMessage(
          phone,
          options.templateName || "hello_world",
          name,
          void 0,
          userId
        );
      case "custom":
        messageContent = options.customMessage || "";
        return await sendCustomMessage(phone, options.customMessage || "", userId);
      case "ai_agent":
        messageContent = "[AI Generated Message]";
        return await sendAIAgentMessage(
          phone,
          options.agentId || "",
          `Contact name: ${name}`,
          userId
        );
      default:
        return { success: false, error: "Invalid message type" };
    }
  })();
  await logBroadcastMessage({
    userId,
    campaignName: SINGLE_MESSAGE_CAMPAIGN_NAME,
    contactName: name || "Unknown",
    contactPhone: phone,
    messageType,
    templateName: options.templateName,
    message: messageContent,
    status: result.success ? "sent" : "failed",
    messageId: result.messageId,
    error: result.error,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  return {
    ...result,
    error_code: result.error_code || null,
    template_name: result.template_name || null,
    phone_number: result.phone_number || null
  };
}
function parseExcelContacts(data) {
  const contacts = [];
  const errors = [];
  let rowNum = 1;
  for (const row of data) {
    rowNum++;
    if (typeof row !== "object" || row === null) continue;
    const record = row;
    const keys = Object.keys(record);
    if (rowNum === 2) {
    }
    let name = "";
    for (const key of keys) {
      const lowerKey = key.toLowerCase().trim();
      if (lowerKey === "name" || lowerKey === "full_name" || lowerKey === "fullname" || lowerKey === "contact_name" || lowerKey === "customer_name" || lowerKey === "customer") {
        name = String(record[key] || "").trim();
        break;
      }
    }
    let phone = "";
    for (const key of keys) {
      const lowerKey = key.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      if (lowerKey === "phone" || lowerKey === "mobile" || lowerKey === "phone_number" || lowerKey === "mobile_number" || lowerKey === "phonenumber" || lowerKey === "mobilenumber" || lowerKey === "contact" || lowerKey === "whatsapp" || lowerKey === "whatsapp_number" || lowerKey === "whatsapp_phone" || lowerKey === "whatsapp_phone_number" || lowerKey === "cell" || lowerKey === "telephone") {
        phone = String(record[key] || "").trim();
        break;
      }
    }
    let email = "";
    for (const key of keys) {
      const lowerKey = key.toLowerCase().trim();
      if (lowerKey === "email" || lowerKey === "email_address" || lowerKey === "emailaddress") {
        email = String(record[key] || "").trim();
        break;
      }
    }
    if (phone) {
      if (/^\s*\d+(?:\.\d+)?e\+?\d+\s*$/i.test(phone)) {
        errors.push(
          `Row ${rowNum}: Phone number was saved in scientific notation (${phone}). Format the WhatsApp Number column as Text and enter the full number again.`
        );
        continue;
      }
      phone = phone.replace(/[^\d+]/g, "");
      if (phone.includes("+") && !phone.startsWith("+")) {
        phone = phone.replace(/\+/g, "");
      }
    }
    if (!phone) {
      errors.push(`Row ${rowNum}: Missing phone number`);
      continue;
    }
    if (phone.length < 8) {
      errors.push(`Row ${rowNum}: Phone number too short (${phone})`);
      continue;
    }
    if (!name) {
      name = `Contact ${phone.slice(-4)}`;
    }
    contacts.push({
      name,
      phone,
      email: email || void 0
    });
  }
  if (errors.length > 0) {
  }
  return {
    contacts,
    totalRows: data.length,
    validContacts: contacts.length,
    errors: errors.slice(0, 10)
    // Return first 10 errors
  };
}
function exportContactsToJSON(contacts) {
  return contacts.map((c) => ({
    name: c.name,
    phone: c.phone,
    email: c.email || "",
    tags: c.tags?.join(", ") || ""
  }));
}
async function saveImportedContacts(userId, contacts, source = "import") {
  const errors = [];
  let saved = 0;
  let duplicates = 0;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const existingContacts = (await mongodb.readCollection("imported_contacts")).filter((contact) => contact.userId === userId);
    const existingPhones = new Set(
      existingContacts.map((c) => c.phone.replace(/\D/g, ""))
    );
    const uniqueContacts = [];
    const seenPhones = /* @__PURE__ */ new Set();
    for (const contact of contacts) {
      const normalizedPhone = contact.phone.replace(/\D/g, "");
      if (existingPhones.has(normalizedPhone) || seenPhones.has(normalizedPhone)) {
        duplicates++;
        continue;
      }
      seenPhones.add(normalizedPhone);
      uniqueContacts.push({
        id: `contact-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        userId,
        name: contact.name,
        phone: contact.phone,
        email: contact.email || "",
        tags: contact.tags || [],
        source,
        createdAt: now,
        updatedAt: now
      });
    }
    if (uniqueContacts.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < uniqueContacts.length; i += BATCH_SIZE) {
        const batch = uniqueContacts.slice(i, i + BATCH_SIZE);
        await mongodb.insertMany("imported_contacts", batch);
        saved += batch.length;
      }
    }
  } catch (error) {
    console.error("[ImportContacts] Bulk import failed:", error);
    errors.push(`Bulk import failed: ${error}`);
  }
  return { saved, duplicates, errors };
}
async function getImportedContacts(userId) {
  try {
    const contacts = await mongodb.readCollection(
      "imported_contacts"
    );
    return contacts.filter((contact) => contact.userId === userId).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error("[ImportContacts] Failed to get contacts:", error);
    return [];
  }
}
async function deleteImportedContact(userId, id) {
  try {
    await mongodb.deleteOne("imported_contacts", { id, userId });
    return true;
  } catch (error) {
    console.error("[ImportContacts] Failed to delete contact:", error);
    return false;
  }
}
async function getScheduledBroadcasts() {
  try {
    return await mongodb.readCollection(
      "scheduled_broadcasts"
    );
  } catch (error) {
    console.error(
      "[ScheduledBroadcasts] Failed to get scheduled broadcasts:",
      error
    );
    return [];
  }
}
async function processScheduledBroadcasts() {
  const now = /* @__PURE__ */ new Date();
  try {
    const scheduled = await mongodb.readCollection(
      "scheduled_broadcasts"
    );
    const duebroadcasts = scheduled.filter(
      (s) => s.status === "scheduled" && new Date(s.scheduledAt) <= now
    );
    if (duebroadcasts.length === 0) {
      return;
    }
    for (const broadcast of duebroadcasts) {
      await mongodb.updateOne(
        "scheduled_broadcasts",
        { id: broadcast.id },
        {
          ...broadcast,
          status: "sending"
        }
      );
      let successful = 0;
      let failed = 0;
      const credentials = await whatsappService.getWhatsAppCredentialsStrict(
        broadcast.userId
      );
      if (!credentials) {
        console.error(
          `[Scheduler] WhatsApp credentials not configured for broadcast ${broadcast.id}`
        );
        await mongodb.updateOne(
          "scheduled_broadcasts",
          { id: broadcast.id },
          {
            ...broadcast,
            status: "failed",
            sentCount: 0,
            failedCount: broadcast.contacts.length
          }
        );
        continue;
      }
      for (const contact of broadcast.contacts) {
        let result;
        let messageContent = "";
        switch (broadcast.messageType) {
          case "template":
            result = await sendTemplateMessage(
              contact.phone,
              broadcast.templateName || "hello_world",
              contact.name,
              void 0,
              broadcast.userId
            );
            messageContent = `[Template: ${broadcast.templateName || "hello_world"}]`;
            break;
          case "custom":
            result = await sendCustomMessage(
              contact.phone,
              broadcast.customMessage || "",
              broadcast.userId
            );
            messageContent = broadcast.customMessage || "";
            break;
          case "ai_agent":
            result = await sendAIAgentMessage(
              contact.phone,
              broadcast.agentId || "",
              `Contact name: ${contact.name}`,
              broadcast.userId
            );
            messageContent = "[AI Generated Message]";
            break;
          default:
            result = { success: false, error: "Invalid message type" };
        }
        await logBroadcastMessage({
          userId: broadcast.userId,
          campaignName: broadcast.campaignName,
          contactName: contact.name,
          contactPhone: contact.phone,
          messageType: broadcast.messageType,
          templateName: broadcast.templateName,
          message: messageContent,
          status: result.success ? "sent" : "failed",
          messageId: result.messageId,
          error: result.error,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await mongodb.updateOne(
        "scheduled_broadcasts",
        { id: broadcast.id },
        {
          ...broadcast,
          status: "sent",
          sentCount: successful,
          failedCount: failed
        }
      );
    }
  } catch (error) {
    console.error("[Scheduler] Error processing scheduled broadcasts:", error);
  }
}
const SCHEDULED_BROADCAST_QUEUE_NAME = "whatsapp-scheduled-broadcasts";
let scheduledBroadcastConnection = null;
let scheduledBroadcastQueue = null;
let scheduledBroadcastWorker = null;
function getScheduledBroadcastRedisUrl() {
  const explicitUrl = String(process.env.REDIS_URL || "").trim();
  if (explicitUrl) return explicitUrl;
  const host = String(process.env.REDIS_HOST || "").trim();
  if (!host) return "";
  const port = String(process.env.REDIS_PORT || "6379").trim() || "6379";
  const password = String(process.env.REDIS_PASSWORD || "").trim();
  const auth = password ? `:${encodeURIComponent(password)}@` : "";
  return `redis://${auth}${host}:${port}`;
}
function getScheduledBroadcastQueue() {
  const redisUrl = getScheduledBroadcastRedisUrl();
  if (!redisUrl) return null;
  if (!scheduledBroadcastConnection) {
    scheduledBroadcastConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
  }
  if (!scheduledBroadcastQueue) {
    scheduledBroadcastQueue = new Queue(SCHEDULED_BROADCAST_QUEUE_NAME, {
      connection: scheduledBroadcastConnection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 5e3 },
        removeOnComplete: 100,
        removeOnFail: 100
      }
    });
  }
  return scheduledBroadcastQueue;
}
async function startScheduler() {
  if (!process.env.MONGODB_URL) {
    console.warn(
      "[Scheduler] Skipping broadcast scheduler: MONGODB_URL is not configured"
    );
    return;
  }
  const queue = getScheduledBroadcastQueue();
  if (!queue) {
    console.warn("[Scheduler] Skipping broadcast scheduler: Redis is not configured");
    return;
  }
  if (!scheduledBroadcastWorker) {
    scheduledBroadcastWorker = new Worker(
      SCHEDULED_BROADCAST_QUEUE_NAME,
      async (job) => {
        if (job.name === "process-scheduled-broadcasts") {
          await processScheduledBroadcasts();
        }
      },
      { connection: scheduledBroadcastConnection, concurrency: 1 }
    );
    scheduledBroadcastWorker.on("failed", (job, error) => {
      console.error(
        `[Scheduler] Broadcast job ${job?.id || "unknown"} failed:`,
        error?.message || error
      );
    });
    console.log("[Scheduler] Broadcast BullMQ worker started");
  }
  await queue.add("process-scheduled-broadcasts", {}, {
    jobId: "whatsapp-scheduled-broadcasts-repeat",
    repeat: { every: 3e4 }
  });
  await processScheduledBroadcasts();
}
async function stopScheduler() {
  if (scheduledBroadcastWorker) {
    await scheduledBroadcastWorker.close();
    scheduledBroadcastWorker = null;
  }
  if (scheduledBroadcastQueue) {
    await scheduledBroadcastQueue.close();
    scheduledBroadcastQueue = null;
  }
  if (scheduledBroadcastConnection) {
    await scheduledBroadcastConnection.quit();
    scheduledBroadcastConnection = null;
  }
}
async function cancelScheduledBroadcast(id) {
  try {
    const broadcast = await mongodb.findOne(
      "scheduled_broadcasts",
      { id }
    );
    if (!broadcast) {
      console.error(`[ScheduledBroadcast] Broadcast not found: ${id}`);
      return false;
    }
    if (broadcast.status !== "scheduled") {
      console.error(
        `[ScheduledBroadcast] Cannot cancel broadcast with status: ${broadcast.status}`
      );
      return false;
    }
    await mongodb.updateOne(
      "scheduled_broadcasts",
      { id },
      {
        ...broadcast,
        status: "cancelled"
      }
    );
    return true;
  } catch (error) {
    console.error("[ScheduledBroadcast] Failed to cancel broadcast:", error);
    return false;
  }
}
async function deleteScheduledBroadcast(id) {
  try {
    const broadcast = await mongodb.findOne(
      "scheduled_broadcasts",
      { id }
    );
    if (!broadcast) {
      console.error(
        `[ScheduledBroadcast] Broadcast not found for deletion: ${id}`
      );
      return false;
    }
    await mongodb.deleteOne("scheduled_broadcasts", { id });
    return true;
  } catch (error) {
    console.error("[ScheduledBroadcast] Failed to delete broadcast:", error);
    return false;
  }
}
export {
  SINGLE_MESSAGE_CAMPAIGN_NAME,
  cancelScheduledBroadcast,
  createBroadcastList,
  createScheduledMessage,
  deleteBroadcastList,
  deleteImportedContact,
  deleteScheduledBroadcast,
  deleteScheduledMessage,
  exportContactsToJSON,
  getBroadcastListById,
  getBroadcastLists,
  getBroadcastLogs,
  getImportedContacts,
  getScheduledBroadcasts,
  getScheduledMessages,
  logBroadcastMessage,
  markBroadcastLogAsReplied,
  parseExcelContacts,
  processScheduledBroadcasts,
  saveImportedContacts,
  sendAIAgentMessage,
  sendBroadcast,
  sendCustomMessage,
  sendSingleMessage,
  sendTemplateMessage,
  startScheduler,
  stopScheduler,
  updateBroadcastList,
  updateBroadcastLogFromWebhook,
  updateScheduledMessage
};
