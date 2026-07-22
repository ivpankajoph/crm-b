import { Types } from "mongoose";
import crypto from "crypto";
import { WhatsAppFlow, FlowSyncCheckpoint } from "./flows.model.js";
import * as integrationService from "../integrations/integration.service.js";
import * as credentialsService from "../credentials/credentials.service.js";
import { Contact, Message, UserCredentials } from "../storage/mongodb.adapter.js";
import { decryptStoredValue, encrypt } from "../encryption/encryption.service.js";
import * as flowResponsesService from "./flowResponses.service.js";
const GRAPH_API_VERSION = "v21.0";
const EXTENDED_FLOW_FIELDS = [
  "id",
  "name",
  "status",
  "categories",
  "validation_errors",
  "json_version",
  "data_api_version",
  "data_channel_uri",
  "endpoint_uri",
  "preview",
  "updated_at",
  "health_status",
  "application",
  "whatsapp_business_account"
].join(",");
const SAFE_FLOW_FIELDS = [
  "id",
  "name",
  "status",
  "categories",
  "validation_errors",
  "json_version",
  "data_api_version",
  "data_channel_uri",
  "endpoint_uri",
  "preview",
  "updated_at"
].join(",");
const DEFAULT_METRIC_NAMES = [
  "ENDPOINT_REQUEST_COUNT",
  "ENDPOINT_REQUEST_ERROR",
  "ENDPOINT_REQUEST_ERROR_RATE",
  "ENDPOINT_REQUEST_LATENCY_SECONDS_CEIL_P50",
  "ENDPOINT_REQUEST_LATENCY_SECONDS_CEIL_P90",
  "ENDPOINT_REQUEST_LATENCY_SECONDS_CEIL_P95",
  "ENDPOINT_REQUEST_LATENCY_SECONDS_CEIL_P99"
];
const ALLOWED_FLOW_CATEGORIES = [
  "SIGN_UP",
  "SIGN_IN",
  "APPOINTMENT_BOOKING",
  "LEAD_GENERATION",
  "CONTACT_US",
  "CUSTOMER_SUPPORT",
  "SURVEY",
  "OTHER"
];
const META_IDENTIFIER_REGEX = /^[A-Za-z][A-Za-z_]{0,79}$/;
const MAX_FLOW_NAME_LENGTH = 80;
function createValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}
function normalizeFlowNameOrThrow(name) {
  const normalized = String(name ?? "").trim();
  if (!normalized) {
    throw createValidationError("Flow name is required");
  }
  if (normalized.length > MAX_FLOW_NAME_LENGTH) {
    throw createValidationError(`Flow name must be ${MAX_FLOW_NAME_LENGTH} characters or fewer`);
  }
  if (/[\r\n\t]/.test(normalized)) {
    throw createValidationError("Flow name cannot include line breaks or tab characters");
  }
  return normalized;
}
function normalizeEndpointUriOrThrow(endpointUri) {
  if (endpointUri === void 0 || endpointUri === null) {
    return void 0;
  }
  const normalized = String(endpointUri).trim();
  if (!normalized) return void 0;
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw createValidationError("Endpoint URI must be a valid URL");
  }
  if (parsed.protocol !== "https:") {
    throw createValidationError("Endpoint URI must start with https://");
  }
  return normalized;
}
function normalizeEndpointUriForUpdateOrThrow(endpointUri) {
  const normalized = String(endpointUri ?? "").trim();
  if (!normalized) return "";
  const validated = normalizeEndpointUriOrThrow(normalized);
  return validated || "";
}
function normalizeFlowCategoriesOrThrow(categories) {
  if (!Array.isArray(categories)) {
    throw createValidationError("Flow categories must be an array");
  }
  const normalized = categories.map((item) => String(item ?? "").trim().toUpperCase()).filter(Boolean);
  if (normalized.length === 0) {
    throw createValidationError("At least one flow category is required");
  }
  const invalid = normalized.filter(
    (item) => !ALLOWED_FLOW_CATEGORIES.includes(item)
  );
  if (invalid.length > 0) {
    throw createValidationError(
      `Invalid flow categories: ${invalid.join(", ")}. Allowed categories: ${ALLOWED_FLOW_CATEGORIES.join(", ")}`
    );
  }
  return Array.from(new Set(normalized));
}
function isValidMetaIdentifier(value) {
  return typeof value === "string" && META_IDENTIFIER_REGEX.test(value);
}
function validateMetaIdentifier(value, path, errors, options) {
  const required = options?.required !== false;
  if (typeof value !== "string" || !value.trim()) {
    if (required) {
      errors.push(`${path} is required`);
    }
    return;
  }
  const normalized = value.trim();
  if (!isValidMetaIdentifier(normalized)) {
    errors.push(
      `${path} "${value}" is invalid. Use only letters and underscores, starting with a letter (max 80 chars)`
    );
  }
}
function collectNamedComponents(node, path, errors, seenNames) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectNamedComponents(item, `${path}[${index}]`, errors, seenNames));
    return;
  }
  if (!node || typeof node !== "object") {
    return;
  }
  const record = node;
  if (Array.isArray(record["data-source"])) {
    record["data-source"].forEach((item, index) => {
      if (item && typeof item === "object" && "id" in item) {
        validateMetaIdentifier(
          item.id,
          `${path}.data-source[${index}].id`,
          errors
        );
      }
    });
  }
  if (typeof record.type === "string" && "name" in record) {
    validateMetaIdentifier(record.name, `${path}.name`, errors);
    if (typeof record.name === "string" && record.name.trim()) {
      const normalized = record.name.trim();
      if (seenNames.has(normalized)) {
        errors.push(`${path}.name "${normalized}" is duplicated. Component names should be unique per screen`);
      } else {
        seenNames.add(normalized);
      }
    }
  }
  for (const [key, value] of Object.entries(record)) {
    if (key === "name" && typeof record.type === "string") continue;
    collectNamedComponents(value, `${path}.${key}`, errors, seenNames);
  }
}
function countComponentType(node, componentType) {
  if (Array.isArray(node)) {
    return node.reduce((total, item) => total + countComponentType(item, componentType), 0);
  }
  if (!node || typeof node !== "object") return 0;
  const record = node;
  return (record.type === componentType ? 1 : 0) + Object.values(record).reduce(
    (total, value) => total + countComponentType(value, componentType),
    0
  );
}
function toSafeDate(value) {
  if (!value) return void 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? void 0 : date;
}
function normalizeStatus(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "DRAFT" || normalized === "PUBLISHED" || normalized === "DEPRECATED" || normalized === "BLOCKED" || normalized === "THROTTLED") {
    return normalized;
  }
  return "DRAFT";
}
function parseValidationErrors(errors) {
  if (!Array.isArray(errors)) return [];
  return errors.map((item) => {
    const message = item?.message || item?.details || item?.error;
    if (!message) return "";
    const location = [
      item.path ? `path ${item.path}` : "",
      item.property ? `property ${item.property}` : "",
      item.line_start ? `line ${item.line_start}` : "",
      item.column_start ? `column ${item.column_start}` : ""
    ].filter(Boolean).join(", ");
    return location ? `${message} (${location})` : message;
  }).filter((value) => Boolean(value));
}
function extractMetaError(responsePayload, statusCode) {
  const payload = responsePayload;
  const errorObject = payload?.error || payload;
  const userTitle = String(errorObject?.error_user_title || "").trim();
  const userMessage = String(errorObject?.error_user_msg || "").trim();
  const technicalDetails = String(errorObject?.error_data?.details || "").trim();
  const metaMessage = String(errorObject?.message || "").trim();
  const message = [userTitle, userMessage || technicalDetails].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(": ") || metaMessage || `Meta API request failed (${statusCode})`;
  const error = new Error(message);
  error.status = statusCode;
  error.code = errorObject?.code;
  error.subcode = errorObject?.error_subcode;
  error.fbtraceId = errorObject?.fbtrace_id;
  error.details = userMessage || technicalDetails || void 0;
  error.userTitle = userTitle || void 0;
  error.userMessage = userMessage || void 0;
  error.meta = payload;
  return error;
}
function isFlowFieldPermissionError(error) {
  const err = error;
  const message = String(err?.message || "").toLowerCase();
  const details = String(err?.details || "").toLowerCase();
  if (Number(err?.code) !== 200) return false;
  return message.includes("permission") || message.includes("access this field") || details.includes("permission") || details.includes("access this field");
}
function appendQueryParams(url, query) {
  if (!query) return;
  for (const [key, value] of Object.entries(query)) {
    if (value === void 0 || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === void 0 || item === null || item === "") continue;
        url.searchParams.append(key, String(item));
      }
      continue;
    }
    url.searchParams.append(key, String(value));
  }
}
async function requestMeta(path, options) {
  const baseUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${path.replace(/^\//, "")}`);
  appendQueryParams(baseUrl, options.query);
  const method = options.method || "GET";
  const headers = {
    Authorization: `Bearer ${options.token}`
  };
  let body;
  if (options.body !== void 0 && options.body !== null) {
    if (options.body instanceof FormData) {
      body = options.body;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
  }
  const response = await fetch(baseUrl.toString(), {
    method,
    headers,
    body
  });
  const rawText = await response.text();
  let payload = {};
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = { raw: rawText };
    }
  }
  if (!response.ok) {
    throw extractMetaError(payload, response.status);
  }
  return payload;
}
function buildFlowLookupQuery(userId, idOrFlowId) {
  const conditions = [{ flowId: idOrFlowId }];
  if (Types.ObjectId.isValid(idOrFlowId)) {
    conditions.push({ _id: new Types.ObjectId(idOrFlowId) });
  }
  return {
    userId,
    $or: conditions
  };
}
async function getFlowDocumentOrThrow(userId, idOrFlowId) {
  const flow = await WhatsAppFlow.findOne(buildFlowLookupQuery(userId, idOrFlowId));
  if (!flow) {
    throw new Error("Flow not found");
  }
  return flow;
}
function mapMetaFlowToLocal(userId, flow) {
  return {
    userId,
    flowId: flow.id,
    name: flow.name,
    status: normalizeStatus(flow.status),
    categories: Array.isArray(flow.categories) ? flow.categories : [],
    validationErrors: parseValidationErrors(flow.validation_errors),
    jsonVersion: flow.json_version || void 0,
    dataApiVersion: flow.data_api_version || void 0,
    dataChannelUri: flow.data_channel_uri || void 0,
    endpointUri: flow.endpoint_uri || void 0,
    previewUrl: flow.preview?.preview_url || void 0,
    previewExpiresAt: toSafeDate(flow.preview?.expires_at),
    healthStatus: flow.health_status,
    whatsappBusinessAccount: flow.whatsapp_business_account,
    application: flow.application,
    metaUpdatedAt: toSafeDate(flow.updated_at),
    lastSyncedAt: /* @__PURE__ */ new Date(),
    lastMetaSnapshot: flow
  };
}
async function upsertFlowFromMeta(userId, flow) {
  const payload = mapMetaFlowToLocal(userId, flow);
  const existing = await WhatsAppFlow.findOne({ userId, flowId: flow.id });
  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return existing;
  }
  return WhatsAppFlow.create({
    ...payload,
    entryPoints: [
      {
        id: "default",
        name: "Default Entry",
        type: "CTA"
      }
    ]
  });
}
async function resolveMetaCredentials(userId, requirements) {
  let accessToken;
  let wabaId;
  let phoneNumberId;
  let appId;
  const integrationCreds = await integrationService.getDecryptedCredentials(userId, "whatsapp");
  if (integrationCreds) {
    accessToken = integrationCreds.accessToken || accessToken;
    wabaId = integrationCreds.businessAccountId || wabaId;
    phoneNumberId = integrationCreds.phoneNumberId || phoneNumberId;
    appId = integrationCreds.appId || appId;
  }
  const storedCreds = await credentialsService.getDecryptedCredentials(userId);
  if (storedCreds) {
    accessToken = accessToken || storedCreds.whatsappToken;
    wabaId = wabaId || storedCreds.businessAccountId;
    phoneNumberId = phoneNumberId || storedCreds.phoneNumberId;
    appId = appId || storedCreds.appId;
  }
  accessToken = accessToken || "" || "" || "" || "";
  wabaId = wabaId || "" || "";
  phoneNumberId = phoneNumberId || "";
  appId = appId || process.env.META_APP_ID || process.env.META_APP_ID || process.env.META_APP_ID;
  if (!accessToken) {
    throw new Error("WhatsApp access token is missing. Configure Connected Apps or Settings API credentials.");
  }
  if (requirements?.requireWabaId && !wabaId) {
    throw new Error("Missing WhatsApp Business Account ID (WABA ID).");
  }
  if (requirements?.requirePhoneNumberId && !phoneNumberId) {
    throw new Error("Missing WhatsApp Phone Number ID.");
  }
  if (requirements?.requireAppId && !appId) {
    throw new Error("Missing Meta App ID.");
  }
  return {
    accessToken,
    wabaId,
    phoneNumberId,
    appId
  };
}
async function fetchMetaFlowById(accessToken, flowId, options) {
  try {
    return await requestMeta(flowId, {
      token: accessToken,
      query: {
        fields: EXTENDED_FLOW_FIELDS,
        invalidate_preview: options?.invalidatePreview ? true : void 0
      }
    });
  } catch (error) {
    if (!isFlowFieldPermissionError(error)) {
      throw error;
    }
    return requestMeta(flowId, {
      token: accessToken,
      query: {
        fields: SAFE_FLOW_FIELDS,
        invalidate_preview: options?.invalidatePreview ? true : void 0
      }
    });
  }
}
function validateFlowJson(flowJson) {
  const errors = [];
  if (!flowJson || typeof flowJson !== "object") {
    return { valid: false, errors: ["Flow JSON is required and must be an object"] };
  }
  if (!flowJson.version || typeof flowJson.version !== "string") {
    errors.push('Field "version" is required and must be a string');
  }
  if (!flowJson.data_api_version || typeof flowJson.data_api_version !== "string") {
    errors.push('Field "data_api_version" is required and must be a string');
  }
  const routingModel = flowJson.routing_model && typeof flowJson.routing_model === "object" && !Array.isArray(flowJson.routing_model) ? flowJson.routing_model : null;
  if (!routingModel) {
    errors.push('Field "routing_model" is required and must be an object');
  }
  if (!Array.isArray(flowJson.screens) || flowJson.screens.length === 0) {
    errors.push('At least one screen is required in "screens"');
  } else {
    const screenIds = /* @__PURE__ */ new Set();
    flowJson.screens.forEach((screen, index) => {
      if (!screen?.id) {
        errors.push(`screens[${index}].id is required`);
      } else {
        validateMetaIdentifier(screen.id, `screens[${index}].id`, errors);
        if (screenIds.has(screen.id)) {
          errors.push(`screens[${index}].id "${screen.id}" is duplicated`);
        } else {
          screenIds.add(screen.id);
        }
      }
      if (!screen?.title) {
        errors.push(`screens[${index}].title is required`);
      }
      if (!screen?.layout || typeof screen.layout !== "object") {
        errors.push(`screens[${index}].layout is required`);
      } else {
        const seenComponentNames = /* @__PURE__ */ new Set();
        collectNamedComponents(screen.layout, `screens[${index}].layout`, errors, seenComponentNames);
        const footerCount = countComponentType(screen.layout, "Footer");
        if (footerCount > 1) {
          errors.push(
            `screens[${index}] has ${footerCount} Footers. Meta allows a maximum of one Footer per screen`
          );
        }
      }
    });
    if (routingModel) {
      const routingKeys = Object.keys(routingModel);
      if (routingKeys.length === 0) {
        errors.push('Field "routing_model" must have at least one screen mapping');
      }
      for (const key of routingKeys) {
        validateMetaIdentifier(key, `routing_model.${key}`, errors);
        if (!screenIds.has(key)) {
          errors.push(`routing_model.${key} does not match any screen id`);
        }
        const destinations = routingModel[key];
        if (!Array.isArray(destinations)) {
          errors.push(`routing_model.${key} must be an array of screen ids`);
        } else {
          destinations.forEach((destination, index) => {
            validateMetaIdentifier(destination, `routing_model.${key}[${index}]`, errors);
            if (typeof destination === "string" && !screenIds.has(destination)) {
              errors.push(`routing_model.${key}[${index}] "${destination}" does not match any screen id`);
            }
          });
        }
      }
      for (const screenId of screenIds) {
        if (!(screenId in routingModel)) {
          errors.push(`routing_model is missing key for screen "${screenId}"`);
        }
      }
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
async function syncFlowsFromMeta(userId) {
  const result = {
    synced: 0,
    created: 0,
    updated: 0,
    errors: []
  };
  const { accessToken, wabaId } = await resolveMetaCredentials(userId, { requireWabaId: true });
  await FlowSyncCheckpoint.findOneAndUpdate(
    { userId },
    {
      $set: {
        syncStatus: "syncing",
        wabaId
      }
    },
    { upsert: true }
  );
  try {
    let afterCursor;
    while (true) {
      let data;
      try {
        data = await requestMeta(`${wabaId}/flows`, {
          token: accessToken,
          query: {
            fields: EXTENDED_FLOW_FIELDS,
            limit: 200,
            after: afterCursor
          }
        });
      } catch (error) {
        if (!isFlowFieldPermissionError(error)) {
          throw error;
        }
        data = await requestMeta(`${wabaId}/flows`, {
          token: accessToken,
          query: {
            fields: SAFE_FLOW_FIELDS,
            limit: 200,
            after: afterCursor
          }
        });
      }
      const flows = Array.isArray(data.data) ? data.data : [];
      for (const metaFlow of flows) {
        try {
          const exists = await WhatsAppFlow.exists({ userId, flowId: metaFlow.id });
          await upsertFlowFromMeta(userId, metaFlow);
          if (exists) {
            result.updated += 1;
          } else {
            result.created += 1;
          }
          result.synced += 1;
        } catch (error) {
          result.errors.push(`Flow ${metaFlow.id}: ${error.message}`);
        }
      }
      if (!data.paging?.next || !data.paging.cursors?.after) {
        break;
      }
      afterCursor = data.paging.cursors.after;
    }
    await FlowSyncCheckpoint.findOneAndUpdate(
      { userId },
      {
        $set: {
          syncStatus: "idle",
          lastSyncedAt: /* @__PURE__ */ new Date(),
          nextCursor: void 0,
          lastError: void 0
        }
      }
    );
    return result;
  } catch (error) {
    await FlowSyncCheckpoint.findOneAndUpdate(
      { userId },
      {
        $set: {
          syncStatus: "error",
          lastError: error.message
        }
      }
    );
    throw error;
  }
}
async function getFlows(userId, filters) {
  const query = { userId };
  if (filters?.status) {
    query.status = String(filters.status).toUpperCase();
  }
  if (filters?.search) {
    query.name = { $regex: filters.search, $options: "i" };
  }
  const page = Math.max(1, filters?.page || 1);
  const limit = Math.max(1, Math.min(100, filters?.limit || 50));
  const [flows, total] = await Promise.all([
    WhatsAppFlow.find(query).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
    WhatsAppFlow.countDocuments(query)
  ]);
  return { flows, total };
}
async function getFlowById(userId, id) {
  return WhatsAppFlow.findOne(buildFlowLookupQuery(userId, id));
}
async function getConversationStep(userId, idOrFlowId, path = []) {
  const flow = await getFlowDocumentOrThrow(userId, idOrFlowId);
  const builder = flow.flowData;
  if (!builder || builder.type !== "option_response") {
    throw createValidationError("This Flow does not have a conversational button configuration");
  }
  let options = Array.isArray(builder.options) ? builder.options : [];
  let selected = null;
  for (const index of path) {
    selected = options[index];
    if (!selected) {
      throw createValidationError("This conversation option is no longer available");
    }
    options = Array.isArray(selected.options) ? selected.options : [];
  }
  const hasNestedOptions = selected?.nextType === "options" && options.length > 0;
  if (selected && !hasNestedOptions) {
    return {
      userId: flow.userId,
      flowId: String(flow._id),
      flowName: flow.name,
      bodyText: String(selected.response || "").trim() || `You selected ${String(selected.title || "this option")}.`,
      buttons: [],
      complete: true
    };
  }
  const bodyText = selected ? String(selected.nextQuestion || "What would you like to choose?").trim() : String(builder.message || "").trim() || [
    String(builder.heading || "").trim(),
    String(builder.description || "").trim(),
    String(builder.question || "What would you like to do?").trim()
  ].filter(Boolean).join("\n\n");
  return {
    userId: flow.userId,
    flowId: String(flow._id),
    flowName: flow.name,
    bodyText,
    buttons: options.filter((option) => String(option?.title || "").trim()).slice(0, 3).map((option, index) => ({
      id: `cflow:${String(flow._id)}:${[...path, index].join(".")}`,
      title: String(option.title).trim()
    })),
    complete: false
  };
}
async function resolveConversationFlowOwner(idOrFlowId) {
  if (!idOrFlowId) return null;
  const conditions = [{ flowId: idOrFlowId }];
  if (Types.ObjectId.isValid(idOrFlowId)) {
    conditions.push({ _id: new Types.ObjectId(idOrFlowId) });
  }
  const flow = await WhatsAppFlow.findOne({ $or: conditions }).select({ userId: 1 }).lean();
  return flow?.userId ? String(flow.userId) : null;
}
async function getFlowByFlowId(userId, flowId) {
  return WhatsAppFlow.findOne({ userId, flowId });
}
async function getFlowDetailsFromMeta(userId, idOrFlowId, options) {
  const flow = await getFlowDocumentOrThrow(userId, idOrFlowId);
  const { accessToken } = await resolveMetaCredentials(userId);
  const meta = await fetchMetaFlowById(accessToken, flow.flowId, {
    invalidatePreview: options?.invalidatePreview
  });
  const localFlow = await upsertFlowFromMeta(userId, meta);
  return { flow: localFlow, meta };
}
async function updateFlowEntryPoints(userId, id, entryPoints) {
  return WhatsAppFlow.findOneAndUpdate(
    buildFlowLookupQuery(userId, id),
    { $set: { entryPoints } },
    { new: true }
  );
}
async function attachFlowToTemplate(userId, flowId, templateId) {
  return WhatsAppFlow.findOneAndUpdate(
    buildFlowLookupQuery(userId, flowId),
    { $addToSet: { linkedTemplateIds: templateId } },
    { new: true }
  );
}
async function detachFlowFromTemplate(userId, flowId, templateId) {
  return WhatsAppFlow.findOneAndUpdate(
    buildFlowLookupQuery(userId, flowId),
    { $pull: { linkedTemplateIds: templateId } },
    { new: true }
  );
}
async function attachFlowToAgent(userId, flowId, agentId) {
  return WhatsAppFlow.findOneAndUpdate(
    buildFlowLookupQuery(userId, flowId),
    { $addToSet: { linkedAgentIds: agentId } },
    { new: true }
  );
}
async function detachFlowFromAgent(userId, flowId, agentId) {
  return WhatsAppFlow.findOneAndUpdate(
    buildFlowLookupQuery(userId, flowId),
    { $pull: { linkedAgentIds: agentId } },
    { new: true }
  );
}
async function deleteFlow(userId, id) {
  const result = await WhatsAppFlow.deleteOne(buildFlowLookupQuery(userId, id));
  return result.deletedCount > 0;
}
async function getSyncStatus(userId) {
  const [checkpoint, totalFlows] = await Promise.all([
    FlowSyncCheckpoint.findOne({ userId }),
    WhatsAppFlow.countDocuments({ userId })
  ]);
  return {
    lastSyncedAt: checkpoint?.lastSyncedAt,
    syncStatus: checkpoint?.syncStatus || "idle",
    lastError: checkpoint?.lastError,
    totalFlows
  };
}
async function getFlowStats(userId) {
  const [total, published, draft, linkedTemplates, linkedAgents] = await Promise.all([
    WhatsAppFlow.countDocuments({ userId }),
    WhatsAppFlow.countDocuments({ userId, status: "PUBLISHED" }),
    WhatsAppFlow.countDocuments({ userId, status: "DRAFT" }),
    WhatsAppFlow.countDocuments({ userId, linkedTemplateIds: { $exists: true, $ne: [] } }),
    WhatsAppFlow.countDocuments({ userId, linkedAgentIds: { $exists: true, $ne: [] } })
  ]);
  return {
    totalFlows: total,
    publishedFlows: published,
    draftFlows: draft,
    linkedToTemplates: linkedTemplates,
    linkedToAgents: linkedAgents
  };
}
async function createFlowInMeta(userId, data) {
  const { accessToken, wabaId } = await resolveMetaCredentials(userId, { requireWabaId: true });
  const normalizedName = normalizeFlowNameOrThrow(data.name);
  const normalizedCategories = normalizeFlowCategoriesOrThrow(data.categories);
  const normalizedEndpointUri = normalizeEndpointUriOrThrow(data.endpointUri);
  const normalizedCloneFlowId = data.cloneFlowId ? String(data.cloneFlowId).trim() : void 0;
  if (data.flowJson && typeof data.flowJson === "object") {
    const validation = validateFlowJson(data.flowJson);
    if (!validation.valid) {
      throw createValidationError(`Flow JSON validation failed: ${validation.errors.join("; ")}`);
    }
  }
  const createPayload = {
    name: normalizedName,
    categories: normalizedCategories
  };
  if (normalizedEndpointUri) {
    createPayload.endpoint_uri = normalizedEndpointUri;
  }
  if (normalizedCloneFlowId) {
    createPayload.clone_flow_id = normalizedCloneFlowId;
  }
  const createResponse = await requestMeta(`${wabaId}/flows`, {
    method: "POST",
    token: accessToken,
    body: createPayload
  });
  const flowId = createResponse.id;
  let flow;
  let meta;
  try {
    meta = await fetchMetaFlowById(accessToken, flowId);
    flow = await upsertFlowFromMeta(userId, meta);
  } catch (error) {
    flow = await WhatsAppFlow.create({
      userId,
      flowId,
      name: normalizedName,
      status: "DRAFT",
      categories: normalizedCategories,
      endpointUri: normalizedEndpointUri,
      flowJson: data.flowJson,
      validationErrors: [],
      entryPoints: [
        {
          id: "default",
          name: "Default Entry",
          type: "CTA"
        }
      ],
      lastSyncedAt: /* @__PURE__ */ new Date()
    });
  }
  if (flow && data.flowJson) {
    flow.flowJson = data.flowJson;
    await flow.save();
  }
  return { flowId, flow, meta };
}
async function saveFlowDraft(userId, id, flowData, flowJson) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const validation = validateFlowJson(flowJson);
  flow.flowData = flowData;
  flow.flowJson = flowJson;
  flow.draftValidationErrors = validation.errors;
  flow.lastSyncedAt = /* @__PURE__ */ new Date();
  await flow.save();
  return flow;
}
async function uploadFlowJsonAsset(accessToken, flowId, flowJson) {
  const formData = new FormData();
  formData.append("name", "flow.json");
  formData.append("asset_type", "FLOW_JSON");
  formData.append(
    "file",
    new Blob([JSON.stringify(flowJson, null, 2)], { type: "application/json" }),
    "flow.json"
  );
  return requestMeta(`${flowId}/assets`, {
    method: "POST",
    token: accessToken,
    body: formData
  });
}
async function updateAndPublishFlow(userId, id) {
  let flow = await getFlowDocumentOrThrow(userId, id);
  if (!flow.flowJson || typeof flow.flowJson !== "object") {
    throw new Error("No valid Flow JSON found for this draft");
  }
  const validation = validateFlowJson(flow.flowJson);
  flow.draftValidationErrors = validation.errors;
  if (!validation.valid) {
    await flow.save();
    throw new Error(`Draft JSON validation failed: ${validation.errors.join("; ")}`);
  }
  const endpointSetup = await setupFlowEndpoint(userId, id);
  flow = endpointSetup.flow;
  const { accessToken } = await resolveMetaCredentials(userId);
  const uploadResult = await uploadFlowJsonAsset(accessToken, flow.flowId, flow.flowJson);
  const uploadValidationErrors = parseValidationErrors(uploadResult?.validation_errors);
  if (uploadValidationErrors.length > 0) {
    flow.validationErrors = uploadValidationErrors;
    await flow.save();
    throw new Error(`Flow JSON upload has validation errors: ${uploadValidationErrors.join("; ")}`);
  }
  await requestMeta(`${flow.flowId}/publish`, {
    method: "POST",
    token: accessToken
  });
  const refreshed = await getFlowDetailsFromMeta(userId, id, { invalidatePreview: true });
  return refreshed.flow;
}
async function publishFlowInMeta(userId, id) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);
  await requestMeta(`${flow.flowId}/publish`, {
    method: "POST",
    token: accessToken
  });
  const refreshed = await getFlowDetailsFromMeta(userId, id, { invalidatePreview: true });
  return refreshed.flow;
}
async function deprecateFlowInMeta(userId, id) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);
  await requestMeta(`${flow.flowId}/deprecate`, {
    method: "POST",
    token: accessToken
  });
  const refreshed = await getFlowDetailsFromMeta(userId, id);
  return refreshed.flow;
}
async function deleteFlowInMeta(userId, id) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  if (flow.status !== "DRAFT") {
    throw new Error("Only draft flows can be deleted from Meta");
  }
  const { accessToken } = await resolveMetaCredentials(userId);
  await requestMeta(flow.flowId, {
    method: "DELETE",
    token: accessToken
  });
  await WhatsAppFlow.deleteOne({ _id: flow._id });
  return true;
}
async function updateFlowMetadataInMeta(userId, id, updates) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);
  const payload = {};
  if (updates.name !== void 0) payload.name = normalizeFlowNameOrThrow(updates.name);
  if (updates.categories !== void 0) {
    payload.categories = normalizeFlowCategoriesOrThrow(updates.categories);
  }
  if (updates.endpointUri !== void 0) {
    payload.endpoint_uri = normalizeEndpointUriForUpdateOrThrow(updates.endpointUri);
  }
  if (Object.keys(payload).length === 0) {
    throw new Error("At least one field is required to update flow metadata");
  }
  await requestMeta(flow.flowId, {
    method: "POST",
    token: accessToken,
    body: payload
  });
  return getFlowDetailsFromMeta(userId, id, { invalidatePreview: true });
}
async function cloneFlowInMeta(userId, id, options) {
  const sourceFlow = await getFlowDocumentOrThrow(userId, id);
  const categories = options?.categories && options.categories.length > 0 ? options.categories : sourceFlow.categories.filter(Boolean);
  return createFlowInMeta(userId, {
    name: options?.name || `${sourceFlow.name}_copy`,
    categories: categories.length > 0 ? categories : ["OTHER"],
    endpointUri: options?.endpointUri || sourceFlow.endpointUri,
    cloneFlowId: sourceFlow.flowId
  });
}
async function getFlowAssetsFromMeta(userId, id) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);
  return requestMeta(`${flow.flowId}/assets`, {
    token: accessToken,
    query: {
      limit: 200
    }
  });
}
async function getFlowAssetContentFromMeta(userId, id, assetId) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);
  const assetsResponse = await requestMeta(`${flow.flowId}/assets`, {
    token: accessToken,
    query: {
      limit: 200
    }
  });
  const assets = Array.isArray(assetsResponse.data) ? assetsResponse.data : [];
  const targetAsset = assetId && assets.find((item) => String(item.id) === String(assetId)) || assets.find((item) => String(item.asset_type || "").toUpperCase() === "FLOW_JSON");
  if (!targetAsset) {
    throw new Error("No flow asset found for this flow");
  }
  let downloadUrl = targetAsset.download_url || targetAsset.url || targetAsset.asset_url || targetAsset.asset_download_url;
  if (!downloadUrl && targetAsset.id) {
    const assetDetails = await requestMeta(String(targetAsset.id), {
      token: accessToken,
      query: {
        fields: "id,name,asset_type,download_url"
      }
    });
    downloadUrl = assetDetails.download_url || assetDetails.url || assetDetails.asset_url || assetDetails.asset_download_url;
  }
  if (!downloadUrl) {
    throw new Error("Flow asset exists but no download URL is available");
  }
  const downloadResponse = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!downloadResponse.ok) {
    const payload = await downloadResponse.text();
    throw new Error(`Failed to download flow asset: ${payload || downloadResponse.statusText}`);
  }
  const text = await downloadResponse.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = void 0;
  }
  return {
    asset: targetAsset,
    downloadUrl,
    contentType: downloadResponse.headers.get("content-type"),
    text,
    json
  };
}
async function getFlowMetricsFromMeta(userId, id, options) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);
  const metricNames = Array.isArray(options?.metricNames) && options.metricNames.length > 0 ? options.metricNames : DEFAULT_METRIC_NAMES;
  return requestMeta(`${flow.flowId}/metrics`, {
    token: accessToken,
    query: {
      metric_name: metricNames,
      granularity: options?.granularity || "DAY",
      since: options?.start,
      until: options?.end
    }
  });
}
function normalizePhoneNumber(input) {
  return String(input || "").replace(/\D/g, "");
}
function extractScreenIdsFromFlowJson(flowJson) {
  if (!flowJson || typeof flowJson !== "object") return [];
  const screens = flowJson.screens;
  if (!Array.isArray(screens)) return [];
  return screens.map((screen) => screen && typeof screen === "object" ? String(screen.id || "").trim() : "").filter(Boolean);
}
async function resolveFlowStartScreenId(userId, id, flow, requestedScreen) {
  const normalizedRequested = String(requestedScreen || "").trim();
  const localScreenIds = extractScreenIdsFromFlowJson(flow.flowJson);
  if (normalizedRequested) {
    if (localScreenIds.length > 0 && !localScreenIds.includes(normalizedRequested)) {
      throw createValidationError(
        `Invalid screen "${normalizedRequested}". Available screens: ${localScreenIds.join(", ")}`
      );
    }
    return normalizedRequested;
  }
  if (localScreenIds.length > 0) {
    return localScreenIds[0];
  }
  try {
    const assetPayload = await getFlowAssetContentFromMeta(userId, id);
    const remoteScreenIds = extractScreenIdsFromFlowJson(assetPayload.json);
    if (remoteScreenIds.length > 0) {
      return remoteScreenIds[0];
    }
  } catch {
  }
  return void 0;
}
async function sendFlowTestMessage(userId, id, data) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken, phoneNumberId } = await resolveMetaCredentials(userId, {
    requirePhoneNumberId: true
  });
  const to = normalizePhoneNumber(data.phoneNumber);
  if (!to) {
    throw new Error("Valid recipient phone number is required");
  }
  const contact = await Contact.findOne({
    userId,
    phone: { $in: [to, `+${to}`] }
  }).lean();
  const latestInbound = contact ? await Message.findOne({
    userId,
    contactId: contact.id,
    direction: "inbound"
  }).sort({ timestamp: -1 }).lean() : null;
  const lastInboundAt = latestInbound?.timestamp ? new Date(latestInbound.timestamp) : null;
  const isInsideCustomerServiceWindow = lastInboundAt && Date.now() - lastInboundAt.getTime() >= 0 && Date.now() - lastInboundAt.getTime() <= 24 * 60 * 60 * 1e3;
  if (!isInsideCustomerServiceWindow) {
    throw createValidationError(
      "This customer is outside the 24-hour WhatsApp service window. Ask the customer to message first, or send an approved template with a Flow button."
    );
  }
  const sendMode = data.mode || (flow.status === "DRAFT" ? "draft" : "published");
  const flowAction = data.flowAction || "navigate";
  const parameters = {
    flow_message_version: "3",
    flow_token: data.flowToken || `flow_${Date.now()}`,
    flow_cta: data.ctaText || "Start",
    flow_action: flowAction
  };
  if (sendMode === "draft") {
    parameters.mode = "draft";
    parameters.flow_name = flow.name;
  } else {
    parameters.flow_id = flow.flowId;
  }
  const resolvedScreen = await resolveFlowStartScreenId(userId, id, flow, data.screen);
  const actionPayload = {};
  if (resolvedScreen) {
    actionPayload.screen = resolvedScreen;
  }
  if (data.data && Object.keys(data.data).length > 0) {
    actionPayload.data = data.data;
  }
  if (flowAction === "navigate" && !actionPayload.screen) {
    throw createValidationError(
      "Unable to resolve a valid start screen for this flow. Save a draft or provide a valid screen ID."
    );
  }
  if (Object.keys(actionPayload).length > 0) {
    parameters.flow_action_payload = actionPayload;
  }
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "flow",
      body: {
        text: data.bodyText || `Please complete flow: ${flow.name}`
      },
      action: {
        name: "flow",
        parameters
      }
    }
  };
  if (data.headerText) {
    payload.interactive.header = {
      type: "text",
      text: data.headerText
    };
  }
  if (data.footerText) {
    payload.interactive.footer = {
      text: data.footerText
    };
  }
  const response = await requestMeta(`${phoneNumberId}/messages`, {
    method: "POST",
    token: accessToken,
    body: payload
  });
  const messageId = response?.messages?.[0]?.id;
  if (!messageId) {
    throw new Error("Flow message accepted but message ID is missing in response");
  }
  return {
    messageId,
    payload,
    response
  };
}
async function getPhoneNumberEncryptionStatus(userId, businessPhoneNumberId) {
  const { accessToken, phoneNumberId } = await resolveMetaCredentials(userId, {
    requirePhoneNumberId: !businessPhoneNumberId
  });
  const targetPhoneId = businessPhoneNumberId || phoneNumberId;
  if (!targetPhoneId) {
    throw new Error("Business Phone Number ID is required");
  }
  const response = await requestMeta(`${targetPhoneId}/whatsapp_business_encryption`, {
    token: accessToken
  });
  return {
    phoneNumberId: targetPhoneId,
    ...response
  };
}
async function setPhoneNumberEncryptionPublicKey(userId, payload) {
  if (!payload.businessPublicKey || !payload.businessPublicKey.trim()) {
    throw new Error("businessPublicKey is required");
  }
  const { accessToken, phoneNumberId } = await resolveMetaCredentials(userId, {
    requirePhoneNumberId: !payload.businessPhoneNumberId
  });
  const targetPhoneId = payload.businessPhoneNumberId || phoneNumberId;
  if (!targetPhoneId) {
    throw new Error("Business Phone Number ID is required");
  }
  const updateResponse = await requestMeta(`${targetPhoneId}/whatsapp_business_encryption`, {
    method: "POST",
    token: accessToken,
    body: {
      business_public_key: payload.businessPublicKey
    }
  });
  const status = await getPhoneNumberEncryptionStatus(userId, targetPhoneId);
  return {
    phoneNumberId: targetPhoneId,
    updateResponse,
    status
  };
}
function getFlowEndpointBaseUrl() {
  const baseUrl = process.env.PUBLIC_APP_URL;
  if (!baseUrl) {
    throw new Error("Public backend URL is not configured");
  }
  return String(baseUrl).replace(/\/+$/, "");
}
async function ensureUserFlowEndpointKeys(userId) {
  let credentials = await UserCredentials.findOne({ userId });
  if (!credentials) {
    credentials = new UserCredentials({
      id: new Types.ObjectId().toString(),
      userId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  let token = String(credentials.flowEndpointToken || "").trim();
  let publicKey = String(credentials.flowEndpointPublicKey || "").trim();
  let privateKey = decryptStoredValue(credentials.flowEndpointPrivateKey);
  if (!token || !publicKey || !privateKey) {
    const generated = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    token = crypto.randomBytes(24).toString("hex");
    publicKey = generated.publicKey;
    privateKey = generated.privateKey;
    credentials.flowEndpointToken = token;
    credentials.flowEndpointPublicKey = publicKey;
    credentials.flowEndpointPrivateKey = encrypt(privateKey);
    await credentials.save();
  }
  return { token, publicKey, privateKey };
}
async function setupFlowEndpoint(userId, idOrFlowId) {
  const flow = await getFlowDocumentOrThrow(userId, idOrFlowId);
  const keys = await ensureUserFlowEndpointKeys(userId);
  const endpointUri = `${getFlowEndpointBaseUrl()}/api/whatsapp-marketing/webhook/whatsapp/flows/endpoint/${keys.token}`;
  await setPhoneNumberEncryptionPublicKey(userId, {
    businessPublicKey: keys.publicKey
  });
  const { accessToken } = await resolveMetaCredentials(userId);
  const endpointForm = new FormData();
  endpointForm.append("endpoint_uri", endpointUri);
  await requestMeta(flow.flowId, {
    method: "POST",
    token: accessToken,
    body: endpointForm
  });
  const refreshed = await getFlowDetailsFromMeta(userId, idOrFlowId, {
    invalidatePreview: true
  });
  const metaEndpoint = String(
    refreshed.meta.endpoint_uri || refreshed.meta.data_channel_uri || ""
  ).trim();
  if (!metaEndpoint) {
    throw new Error("Meta accepted the endpoint update but did not attach endpoint_uri to the Flow");
  }
  return { endpointUri: metaEndpoint, flow: refreshed.flow };
}
async function handleEncryptedFlowEndpoint(token, body) {
  const credentials = await UserCredentials.findOne({ flowEndpointToken: token });
  if (!credentials) throw createValidationError("Unknown Flow endpoint");
  const privateKey = decryptStoredValue(credentials.flowEndpointPrivateKey);
  if (!privateKey) throw new Error("Flow endpoint private key is not configured");
  if (!body.encrypted_flow_data || !body.encrypted_aes_key || !body.initial_vector) {
    throw createValidationError("Encrypted Flow request fields are required");
  }
  const aesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256"
    },
    Buffer.from(body.encrypted_aes_key, "base64")
  );
  const iv = Buffer.from(body.initial_vector, "base64");
  const encryptedFlowData = Buffer.from(body.encrypted_flow_data, "base64");
  const authTag = encryptedFlowData.subarray(encryptedFlowData.length - 16);
  const ciphertext = encryptedFlowData.subarray(0, encryptedFlowData.length - 16);
  const decipher = crypto.createDecipheriv(
    aesKey.length === 32 ? "aes-256-gcm" : "aes-128-gcm",
    aesKey,
    iv
  );
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const request = JSON.parse(decrypted.toString("utf8"));
  const userId = String(credentials.userId);
  if (request.action !== "ping") {
    await flowResponsesService.createFlowResponse({
      userId,
      contactPhone: "flow-endpoint",
      flowToken: request.flow_token ? String(request.flow_token) : void 0,
      flowName: request.screen ? String(request.screen) : void 0,
      replyName: request.action ? String(request.action) : void 0,
      responseJson: request.data || {},
      parsedReplyBody: request,
      rawMessage: { source: "meta_flow_endpoint", request },
      receivedAt: /* @__PURE__ */ new Date()
    });
  }
  const responsePayload = request.action === "ping" ? { version: request.version || "3.0", data: { status: "active" } } : {
    version: request.version || "3.0",
    screen: request.screen || "START",
    data: request.data || {}
  };
  const responseIv = Buffer.from(iv.map((byte) => byte ^ 255));
  const cipher = crypto.createCipheriv(
    aesKey.length === 32 ? "aes-256-gcm" : "aes-128-gcm",
    aesKey,
    responseIv
  );
  const encryptedResponse = Buffer.concat([
    cipher.update(JSON.stringify(responsePayload), "utf8"),
    cipher.final(),
    cipher.getAuthTag()
  ]);
  return encryptedResponse.toString("base64");
}
export {
  attachFlowToAgent,
  attachFlowToTemplate,
  cloneFlowInMeta,
  createFlowInMeta,
  deleteFlow,
  deleteFlowInMeta,
  deprecateFlowInMeta,
  detachFlowFromAgent,
  detachFlowFromTemplate,
  getConversationStep,
  getFlowAssetContentFromMeta,
  getFlowAssetsFromMeta,
  getFlowByFlowId,
  getFlowById,
  getFlowDetailsFromMeta,
  getFlowMetricsFromMeta,
  getFlowStats,
  getFlows,
  getPhoneNumberEncryptionStatus,
  getSyncStatus,
  handleEncryptedFlowEndpoint,
  publishFlowInMeta,
  resolveConversationFlowOwner,
  saveFlowDraft,
  sendFlowTestMessage,
  setPhoneNumberEncryptionPublicKey,
  setupFlowEndpoint,
  syncFlowsFromMeta,
  updateAndPublishFlow,
  updateFlowEntryPoints,
  updateFlowMetadataInMeta,
  validateFlowJson
};
