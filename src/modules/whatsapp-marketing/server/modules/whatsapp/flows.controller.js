import * as flowsService from "./flows.service.js";
import * as flowResponsesService from "./flowResponses.service.js";
import * as flowReportsService from "./flowReports.service.js";
import * as whatsappService from "./whatsapp.service.js";
import { storage } from "../../storage.js";
import * as mongodb from "../../modules/storage/mongodb.adapter.js";
function getUserId(req) {
  const headerUserId = req.headers["x-user-id"];
  if (typeof headerUserId === "string" && headerUserId.trim()) {
    return headerUserId;
  }
  if (Array.isArray(headerUserId) && headerUserId[0]) {
    return headerUserId[0];
  }
  return req.userId || req.user?.id || null;
}
function sendError(res, error, fallbackMessage) {
  const err = error;
  const status = Number(err?.status) || 500;
  const code = Number(err?.code) || void 0;
  const details = err?.details;
  const message = err?.message || fallbackMessage;
  const permissionHint = code === 200 && /permission|access this field/i.test(`${message} ${details || ""}`) ? "Token lacks one or more advanced Flow fields permissions. Reconnect WhatsApp integration with full scopes (business_management, whatsapp_business_management, whatsapp_business_messaging), then re-sync." : void 0;
  res.status(status).json({
    error: message,
    code: err?.code,
    subcode: err?.subcode,
    details,
    userTitle: err?.userTitle,
    userMessage: err?.userMessage,
    hint: permissionHint,
    fbtraceId: err?.fbtraceId,
    meta: err?.meta
  });
}
async function saveFlowSendToInbox(input) {
  try {
    const contact = await storage.getContactByPhone(input.phoneNumber, input.userId) || await storage.createContact({
      userId: input.userId,
      name: input.contactName || input.phoneNumber,
      phone: input.phoneNumber,
      tags: ["whatsapp-flow"]
    });
    await storage.createMessage({
      userId: input.userId,
      contactId: contact.id,
      content: `WhatsApp Flow sent: ${input.flowName}`,
      type: "text",
      direction: "outbound",
      status: "sent",
      whatsappMessageId: input.messageId,
      source: "whatsapp-flow"
    });
  } catch (error) {
    console.error("[Flows] Failed to save Flow send in inbox:", error);
  }
}
function formatConversationPrompt(bodyText, buttons) {
  const optionTitles = buttons.map((button) => String(button?.title || "").trim()).filter(Boolean);
  if (!optionTitles.length) return bodyText;
  return [
    bodyText,
    "",
    "Options:",
    ...optionTitles.map((title, index) => `${index + 1}. ${title}`)
  ].join("\n");
}
async function saveConversationSendToInbox(input) {
  try {
    const contact = await storage.getContactByPhone(input.phoneNumber, input.userId) || await storage.createContact({
      userId: input.userId,
      name: input.phoneNumber,
      phone: input.phoneNumber,
      tags: ["conversation-flow"]
    });
    await storage.createMessage({
      userId: input.userId,
      contactId: contact.id,
      content: formatConversationPrompt(input.bodyText, input.buttons),
      type: "text",
      direction: "outbound",
      status: "sent",
      whatsappMessageId: input.messageId,
      source: "conversation-flow"
    });
    console.log("[Flows] Updating chat to force visibility...", { contactId: contact.id });
    const result = await mongodb.updateOne("chats", { contactId: contact.id }, {
      lastInboundMessageTime: (/* @__PURE__ */ new Date()).toISOString(),
      isFlowLead: true
    });
    console.log("[Flows] Chat update result:", result);
  } catch (error) {
    console.error("[Flows] Failed to save conversation send in inbox:", error);
  }
}
function getFlowStartScreen(flow) {
  const firstScreenId = flow?.flowJson?.screens?.[0]?.id;
  if (typeof firstScreenId === "string" && firstScreenId.trim()) {
    return firstScreenId.trim();
  }
  const snapshotFirstScreenId = flow?.lastMetaSnapshot?.flow_json?.screens?.[0]?.id;
  if (typeof snapshotFirstScreenId === "string" && snapshotFirstScreenId.trim()) {
    return snapshotFirstScreenId.trim();
  }
  return "START";
}
async function ensureCustomerServiceWindow(userId, phoneNumber) {
  const contact = await storage.getContactByPhone(phoneNumber, userId);
  if (!contact) {
    throw Object.assign(
      new Error(
        "This customer is outside the 24-hour WhatsApp service window. Ask the customer to message first, or send an approved template with a Flow button."
      ),
      { status: 400 }
    );
  }
  const messages = await storage.getMessages(contact.id, userId);
  const latestInbound = messages.filter((message) => message.direction === "inbound" && message.timestamp).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
  const lastInboundAt = latestInbound?.timestamp ? new Date(latestInbound.timestamp) : null;
  const ageMs = lastInboundAt ? Date.now() - lastInboundAt.getTime() : Infinity;
  const isInsideWindow = ageMs >= 0 && ageMs <= 24 * 60 * 60 * 1e3;
  if (!isInsideWindow) {
    throw Object.assign(
      new Error(
        "This customer is outside the 24-hour WhatsApp service window. Ask the customer to message first, or send an approved template with a Flow button."
      ),
      { status: 400 }
    );
  }
}
async function syncFlows(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const result = await flowsService.syncFlowsFromMeta(userId);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("[Flows] Sync error:", error);
    sendError(res, error, "Failed to sync flows");
  }
}
async function getFlows(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, search, page, limit } = req.query;
    const result = await flowsService.getFlows(userId, {
      status,
      search,
      page: page ? parseInt(page, 10) : void 0,
      limit: limit ? parseInt(limit, 10) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Flows] Get flows error:", error);
    sendError(res, error, "Failed to get flows");
  }
}
async function getFlowResponses(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { page, limit, search, flowName, flowId, contactPhone, start, end, includeSystem } = req.query;
    const roleHeader = String(req.headers["x-user-role"] || "").trim();
    const isAdmin = roleHeader === "super_admin" || roleHeader === "sub_admin";
    const shouldIncludeSystem = isAdmin && (String(includeSystem || "").toLowerCase() === "1" || String(includeSystem || "").toLowerCase() === "true");
    const result = await flowResponsesService.listFlowResponses(userId, {
      page: page ? parseInt(page, 10) : void 0,
      limit: limit ? parseInt(limit, 10) : void 0,
      search,
      flowName,
      flowId,
      contactPhone,
      start,
      end,
      includeSystem: shouldIncludeSystem
    });
    res.json(result);
  } catch (error) {
    console.error("[Flows] Get flow responses error:", error);
    sendError(res, error, "Failed to get flow responses");
  }
}
async function getFlowResponseSummary(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const includeSystem = req.query.includeSystem;
    const roleHeader = String(req.headers["x-user-role"] || "").trim();
    const isAdmin = roleHeader === "super_admin" || roleHeader === "sub_admin";
    const shouldIncludeSystem = isAdmin && (String(includeSystem || "").toLowerCase() === "1" || String(includeSystem || "").toLowerCase() === "true");
    const result = await flowResponsesService.getFlowResponseSummaryByFlow(userId, {
      includeSystem: shouldIncludeSystem
    });
    res.json(result);
  } catch (error) {
    console.error("[Flows] Get flow response summary error:", error);
    sendError(res, error, "Failed to get flow response summary");
  }
}
async function getFlowResponseById(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const response = await flowResponsesService.getFlowResponseById(userId, req.params.id);
    if (!response) return res.status(404).json({ error: "Flow response not found" });
    res.json(response);
  } catch (error) {
    console.error("[Flows] Get flow response detail error:", error);
    sendError(res, error, "Failed to get flow response");
  }
}
async function getFlowReports(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const result = await flowReportsService.listFlowReports(userId, {
      search: req.query.search,
      status: req.query.status,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      page: req.query.page ? Number(req.query.page) : void 0,
      limit: req.query.limit ? Number(req.query.limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Flows] Flow reports error:", error);
    sendError(res, error, "Failed to get Flow reports");
  }
}
async function getFlowReportDetails(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const result = await flowReportsService.getFlowReportDetails(userId, req.params.id, {
      search: req.query.search,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate
    });
    if (!result) return res.status(404).json({ error: "Flow not found" });
    res.json(result);
  } catch (error) {
    console.error("[Flows] Flow report details error:", error);
    sendError(res, error, "Failed to get Flow report details");
  }
}
async function getFlowById(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await flowsService.getFlowById(userId, req.params.id);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Flows] Get flow error:", error);
    sendError(res, error, "Failed to get flow");
  }
}
async function getFlowMeta(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const result = await flowsService.getFlowDetailsFromMeta(userId, req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Flows] Get flow meta error:", error);
    sendError(res, error, "Failed to get flow meta details");
  }
}
async function refreshFlowPreview(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const result = await flowsService.getFlowDetailsFromMeta(userId, req.params.id, {
      invalidatePreview: true
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Flows] Refresh preview error:", error);
    sendError(res, error, "Failed to refresh flow preview");
  }
}
async function getFlowStats(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stats = await flowsService.getFlowStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("[Flows] Get stats error:", error);
    sendError(res, error, "Failed to get flow stats");
  }
}
async function getSyncStatus(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const status = await flowsService.getSyncStatus(userId);
    res.json(status);
  } catch (error) {
    console.error("[Flows] Get sync status error:", error);
    sendError(res, error, "Failed to get sync status");
  }
}
async function updateEntryPoints(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { entryPoints } = req.body;
    const flow = await flowsService.updateFlowEntryPoints(userId, req.params.id, entryPoints);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Flows] Update entry points error:", error);
    sendError(res, error, "Failed to update entry points");
  }
}
async function updateFlowMeta(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { name, categories, endpointUri } = req.body;
    const result = await flowsService.updateFlowMetadataInMeta(userId, req.params.id, {
      name,
      categories,
      endpointUri
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Flows] Update meta error:", error);
    sendError(res, error, "Failed to update flow metadata");
  }
}
async function cloneFlow(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { name, categories, endpointUri } = req.body;
    const result = await flowsService.cloneFlowInMeta(userId, req.params.id, {
      name,
      categories,
      endpointUri
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Flows] Clone flow error:", error);
    sendError(res, error, "Failed to clone flow");
  }
}
async function getFlowAssets(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const assets = await flowsService.getFlowAssetsFromMeta(userId, req.params.id);
    res.json({ success: true, ...assets });
  } catch (error) {
    console.error("[Flows] Get flow assets error:", error);
    sendError(res, error, "Failed to fetch flow assets");
  }
}
async function downloadFlowAsset(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const payload = await flowsService.getFlowAssetContentFromMeta(userId, req.params.id, req.params.assetId);
    res.json({ success: true, ...payload });
  } catch (error) {
    console.error("[Flows] Download flow asset error:", error);
    sendError(res, error, "Failed to download flow asset");
  }
}
async function getFlowMetrics(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const metricNames = typeof req.query.metricNames === "string" ? req.query.metricNames.split(",").map((item) => item.trim()).filter(Boolean) : void 0;
    const metrics = await flowsService.getFlowMetricsFromMeta(userId, req.params.id, {
      start: req.query.start,
      end: req.query.end,
      granularity: req.query.granularity || "DAY",
      metricNames
    });
    res.json({ success: true, ...metrics });
  } catch (error) {
    console.error("[Flows] Get flow metrics error:", error);
    sendError(res, error, "Failed to fetch flow metrics");
  }
}
async function attachToTemplate(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { templateId } = req.body;
    const flow = await flowsService.attachFlowToTemplate(userId, req.params.id, templateId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Flows] Attach to template error:", error);
    sendError(res, error, "Failed to attach flow to template");
  }
}
async function detachFromTemplate(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await flowsService.detachFlowFromTemplate(userId, req.params.id, req.params.templateId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Flows] Detach from template error:", error);
    sendError(res, error, "Failed to detach flow from template");
  }
}
async function attachToAgent(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { agentId } = req.body;
    const flow = await flowsService.attachFlowToAgent(userId, req.params.id, agentId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Flows] Attach to agent error:", error);
    sendError(res, error, "Failed to attach flow to agent");
  }
}
async function detachFromAgent(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await flowsService.detachFlowFromAgent(userId, req.params.id, req.params.agentId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Flows] Detach from agent error:", error);
    sendError(res, error, "Failed to detach flow from agent");
  }
}
async function sendFlow(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { phoneNumber, contactName, entryPointId, headerText, bodyText, footerText, ctaText } = req.body;
    const normalizedPhoneNumber = String(phoneNumber || "").replace(/\D/g, "");
    if (!normalizedPhoneNumber) {
      return res.status(400).json({ error: "Customer phone number is required" });
    }
    const flow = await flowsService.getFlowById(userId, req.params.id);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    if (flow.status !== "PUBLISHED") {
      return res.status(400).json({ error: "Only published flows can be sent" });
    }
    await ensureCustomerServiceWindow(userId, normalizedPhoneNumber);
    const flowToken = `flow_${flow.flowId}_${Date.now()}`;
    const startScreen = entryPointId ? String(entryPointId).trim() : getFlowStartScreen(flow);
    const result = await whatsappService.sendFlowMessage(userId, {
      to: normalizedPhoneNumber,
      flowId: flow.flowId,
      flowName: flow.name,
      flowToken,
      entryPointId: startScreen,
      headerText: headerText || "Interactive Flow",
      bodyText: bodyText || "Please complete the following flow",
      footerText,
      ctaText: ctaText || "Start"
    });
    await flowReportsService.logFlowSend({
      userId,
      flowMongoId: String(flow._id),
      flowId: flow.flowId,
      flowName: flow.name,
      flowToken,
      contactPhone: normalizedPhoneNumber,
      contactName: contactName ? String(contactName) : void 0,
      messageId: result.messageId,
      success: result.success,
      providerHttpStatus: result.providerHttpStatus,
      error: result.error,
      requestPayload: result.requestPayload,
      providerResponse: result.providerResponse
    });
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to send flow message" });
    }
    await saveFlowSendToInbox({
      userId,
      phoneNumber: normalizedPhoneNumber,
      contactName: contactName ? String(contactName) : void 0,
      flowName: flow.name,
      messageId: result.messageId
    });
    res.json({
      success: true,
      messageId: result.messageId,
      flow: flow.name
    });
  } catch (error) {
    console.error("[Flows] Send flow error:", error);
    sendError(res, error, "Failed to send flow");
  }
}
async function sendFlowTest(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const result = await flowsService.sendFlowTestMessage(userId, req.params.id, {
      phoneNumber: req.body.phoneNumber,
      mode: req.body.mode,
      ctaText: req.body.ctaText,
      headerText: req.body.headerText,
      bodyText: req.body.bodyText,
      footerText: req.body.footerText,
      flowToken: req.body.flowToken,
      flowAction: req.body.flowAction,
      screen: req.body.screen,
      data: req.body.data
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Flows] Send flow test error:", error);
    sendError(res, error, "Failed to send flow test message");
  }
}
async function sendConversationTest(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const phoneNumber = String(req.body.phoneNumber || "").replace(/\D/g, "");
    if (!phoneNumber) {
      return res.status(400).json({ error: "Customer phone number is required" });
    }
    const step = await flowsService.getConversationStep(userId, req.params.id, []);
    const bodyText = req.body.bodyText?.trim() || step.bodyText;
    const result = await whatsappService.sendReplyButtonMessage(
      phoneNumber,
      bodyText,
      step.buttons,
      userId,
      {
        headerText: req.body.headerText,
        footerText: req.body.footerText
      }
    );
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to send conversation" });
    }
    await saveConversationSendToInbox({
      userId,
      phoneNumber,
      bodyText,
      buttons: step.buttons,
      messageId: result.messageId
    });
    res.json({ success: true, messageId: result.messageId, flow: step.flowName });
  } catch (error) {
    console.error("[Flows] Send conversation error:", error);
    sendError(res, error, "Failed to send conversational flow");
  }
}
async function deleteFlow(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const deleted = await flowsService.deleteFlow(userId, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Flow not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("[Flows] Delete flow error:", error);
    sendError(res, error, "Failed to delete flow");
  }
}
async function createFlow(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { name, categories, endpointUri, cloneFlowId, flowJson } = req.body;
    if (!name || !categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: "Name and at least one category are required" });
    }
    const result = await flowsService.createFlowInMeta(userId, {
      name,
      categories,
      endpointUri,
      cloneFlowId,
      flowJson
    });
    res.json({
      success: true,
      flowId: result.flowId,
      flow: result.flow,
      meta: result.meta
    });
  } catch (error) {
    console.error("[Flows] Create flow error:", error);
    sendError(res, error, "Failed to create flow");
  }
}
async function cloneMetaFlow(req, res) {
  return cloneFlow(req, res);
}
async function publishFlow(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await flowsService.publishFlowInMeta(userId, req.params.id);
    res.json({ success: true, flow });
  } catch (error) {
    console.error("[Flows] Publish flow error:", error);
    sendError(res, error, "Failed to publish flow");
  }
}
async function saveFlowDraft(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { flowData, flowJson } = req.body;
    const flow = await flowsService.saveFlowDraft(userId, req.params.id, flowData, flowJson);
    res.json({ success: true, flow, draftValidationErrors: flow.draftValidationErrors || [] });
  } catch (error) {
    console.error("[Flows] Save flow draft error:", error);
    sendError(res, error, "Failed to save flow draft");
  }
}
async function validateDraft(req, res) {
  try {
    const validation = flowsService.validateFlowJson(req.body?.flowJson);
    res.json({ success: true, ...validation });
  } catch (error) {
    console.error("[Flows] Validate draft error:", error);
    sendError(res, error, "Failed to validate flow draft");
  }
}
async function updateAndPublishFlow(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await flowsService.updateAndPublishFlow(userId, req.params.id);
    res.json({ success: true, flow });
  } catch (error) {
    console.error("[Flows] Update and publish flow error:", error);
    sendError(res, error, "Failed to update and publish flow");
  }
}
async function deprecateFlow(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await flowsService.deprecateFlowInMeta(userId, req.params.id);
    res.json({ success: true, flow });
  } catch (error) {
    console.error("[Flows] Deprecate flow error:", error);
    sendError(res, error, "Failed to deprecate flow");
  }
}
async function deleteFlowFromMeta(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    await flowsService.deleteFlowInMeta(userId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("[Flows] Delete from Meta error:", error);
    sendError(res, error, "Failed to delete flow from Meta");
  }
}
async function getEncryptionStatus(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const status = await flowsService.getPhoneNumberEncryptionStatus(
      userId,
      req.query.phoneNumberId
    );
    res.json({ success: true, ...status });
  } catch (error) {
    console.error("[Flows] Get encryption status error:", error);
    sendError(res, error, "Failed to get endpoint encryption status");
  }
}
async function setEncryptionKey(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const payload = await flowsService.setPhoneNumberEncryptionPublicKey(userId, {
      businessPhoneNumberId: req.body.phoneNumberId,
      businessPublicKey: req.body.businessPublicKey
    });
    res.json({ success: true, ...payload });
  } catch (error) {
    console.error("[Flows] Set encryption key error:", error);
    sendError(res, error, "Failed to set endpoint encryption key");
  }
}
async function setupFlowEndpoint(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const result = await flowsService.setupFlowEndpoint(userId, req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Flows] Setup endpoint error:", error);
    sendError(res, error, "Failed to configure Flow endpoint");
  }
}
async function receiveFlowEndpoint(req, res) {
  try {
    const encryptedResponse = await flowsService.handleEncryptedFlowEndpoint(
      req.params.token,
      req.body || {}
    );
    res.type("text/plain").send(encryptedResponse);
  } catch (error) {
    console.error("[Flows] Endpoint request error:", error);
    sendError(res, error, "Failed to process Flow endpoint request");
  }
}
export {
  attachToAgent,
  attachToTemplate,
  cloneFlow,
  cloneMetaFlow,
  createFlow,
  deleteFlow,
  deleteFlowFromMeta,
  deprecateFlow,
  detachFromAgent,
  detachFromTemplate,
  downloadFlowAsset,
  getEncryptionStatus,
  getFlowAssets,
  getFlowById,
  getFlowMeta,
  getFlowMetrics,
  getFlowReportDetails,
  getFlowReports,
  getFlowResponseById,
  getFlowResponseSummary,
  getFlowResponses,
  getFlowStats,
  getFlows,
  getSyncStatus,
  publishFlow,
  receiveFlowEndpoint,
  refreshFlowPreview,
  saveFlowDraft,
  sendConversationTest,
  sendFlow,
  sendFlowTest,
  setEncryptionKey,
  setupFlowEndpoint,
  syncFlows,
  updateAndPublishFlow,
  updateEntryPoints,
  updateFlowMeta,
  validateDraft
};
