import { randomUUID } from "crypto";
import { getMappingByFormId } from "../mapping/mapping.service.js";
import { getAgentById, getAllAgents } from "../aiAgents/agent.service.js";
import { generateAgentResponse } from "../ai/ai.service.js";
import { getAllLeads } from "../facebook/fb.service.js";
import { storage } from "../../storage.js";
import * as aiAnalytics from "../aiAnalytics/aiAnalytics.service.js";
import * as broadcastService from "../broadcast/broadcast.service.js";
import * as campaignService from "../broadcast/campaign.service.js";
import * as contactAgentService from "../contactAgent/contactAgent.service.js";
import * as prefilledTextService from "../prefilledText/prefilledText.service.js";
import { credentialsService } from "../credentials/credentials.service.js";
import * as whatsappService from "./whatsapp.service.js";
import * as flowResponsesService from "./flowResponses.service.js";
import * as flowsService from "./flows.service.js";
import {
  CampaignLog,
  Message,
  UserCredentials,
  WebhookStatusEvent
} from "../storage/mongodb.adapter.js";
import {
  isContactBlocked,
  isPhoneBlocked,
  listAllBlockedContacts
} from "../contacts/contacts.routes.js";
import { getUserId } from "../auth/auth.routes.js";
import { contactAnalyticsService } from "../contactAnalytics/contactAnalytics.service.js";
import { interestClassificationService } from "../automation/interest/interest.service.js";
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
async function isStoredWebhookVerifyToken(token) {
  const [legacyMatch, connectedAccountMatch] = await Promise.all([
    credentialsService.hasWebhookVerifyToken(token),
    whatsappService.hasWebhookVerifyToken(token)
  ]);
  return legacyMatch || connectedAccountMatch;
}
function resolvePublicBaseUrl(req) {
  const envBaseUrl = process.env.PUBLIC_APP_URL;
  if (envBaseUrl && String(envBaseUrl).trim()) {
    return String(envBaseUrl).trim().replace(/\/+$/, "");
  }
  const forwardedProtoRaw = req.headers["x-forwarded-proto"];
  const forwardedProto = Array.isArray(forwardedProtoRaw) ? forwardedProtoRaw[0] : forwardedProtoRaw;
  const proto = String(forwardedProto || req.protocol || "http").split(",")[0].trim();
  const forwardedHostRaw = req.headers["x-forwarded-host"];
  const forwardedHost = Array.isArray(forwardedHostRaw) ? forwardedHostRaw[0] : forwardedHostRaw;
  const host = String(forwardedHost || req.get("host") || process.env.PUBLIC_APP_URL || "").split(",")[0].trim();
  return `${proto}://${host}`;
}
async function resolveUserIdFromPhoneNumberId(phoneNumberId) {
  const normalizedPhoneNumberId = String(phoneNumberId || "").trim();
  if (!normalizedPhoneNumberId) return void 0;
  try {
    const userId = await whatsappService.getUserByPhoneNumberId(
      normalizedPhoneNumberId
    );
    if (userId) {
      console.log(
        `[Webhook] Resolved userId ${userId} for phone_number_id ${normalizedPhoneNumberId}`
      );
      return userId;
    }
    console.log(
      `[Webhook] No user found for phone_number_id ${normalizedPhoneNumberId}`
    );
    return void 0;
  } catch (error) {
    console.error("[Webhook] Error resolving userId:", error);
    return void 0;
  }
}
async function resolveUserIdFromWabaId(wabaId) {
  const normalizedWabaId = String(wabaId || "").trim();
  if (!normalizedWabaId) return void 0;
  try {
    const credentials = await UserCredentials.find({})
      .select({ userId: 1 })
      .lean();
    for (const credential of credentials) {
      const decrypted = await credentialsService.getDecryptedCredentials(
        credential.userId
      );
      if (
        String(decrypted?.businessAccountId || "").trim() === normalizedWabaId
      ) {
        console.log(
          `[Webhook] Resolved userId ${credential.userId} for waba_id ${normalizedWabaId}`
        );
        return String(credential.userId);
      }
    }
    console.log(`[Webhook] No user found for waba_id ${normalizedWabaId}`);
    return void 0;
  } catch (error) {
    console.error("[Webhook] Error resolving userId by waba_id:", error);
    return void 0;
  }
}
async function resolveSingleCredentialsUserId() {
  try {
    const credentials = await UserCredentials.find({}).select({ userId: 1 }).limit(2).lean();
    if (credentials.length === 1 && credentials[0]?.userId) {
      console.log(
        `[Webhook] Using single configured credentials user fallback: ${credentials[0].userId}`
      );
      return String(credentials[0].userId);
    }
  } catch (error) {
    console.error("[Webhook] Error resolving fallback userId:", error);
  }
  return void 0;
}
async function resolveWebhookUserId(input) {
  const byPhoneNumberId = input.phoneNumberId ? await resolveUserIdFromPhoneNumberId(input.phoneNumberId) : void 0;
  if (byPhoneNumberId) return byPhoneNumberId;
  const byWabaId = input.wabaId ? await resolveUserIdFromWabaId(input.wabaId) : void 0;
  if (byWabaId) return byWabaId;
  return resolveSingleCredentialsUserId();
}
function hasFlowSubmissionPayload(message) {
  const interactive = message?.interactive;
  if (!interactive || typeof interactive !== "object") return false;
  const interactiveType = String(interactive?.type || "").toLowerCase();
  if (interactiveType === "nfm_reply") return true;
  if (interactive?.nfm_reply) return true;
  if (safeParseJsonRecord(interactive?.response_json)) return true;
  if (safeParseJsonRecord(interactive?.body?.response_json)) return true;
  if (interactiveType && interactiveType !== "button_reply" && interactiveType !== "list_reply" && (interactive?.body || interactive?.response_json)) {
    return true;
  }
  return false;
}
function safeParseJsonRecord(value) {
  if (!value) return void 0;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") return void 0;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return void 0;
  }
  return void 0;
}
function parseFlowSubmissionFromMessage(message) {
  const interactive = message?.interactive || {};
  const nfmReply = interactive?.nfm_reply || {};
  const interactiveBody = interactive?.body;
  const parsedReplyBody = safeParseJsonRecord(nfmReply?.response_json) || safeParseJsonRecord(nfmReply?.body) || safeParseJsonRecord(interactive?.response_json) || safeParseJsonRecord(interactiveBody?.response_json) || safeParseJsonRecord(interactiveBody) || {};
  const nestedResponseJson = safeParseJsonRecord(parsedReplyBody?.response_json);
  const responseJson = nestedResponseJson || safeParseJsonRecord(parsedReplyBody?.flow_response) || parsedReplyBody;
  const flowToken = String(parsedReplyBody?.flow_token || parsedReplyBody?.flowToken || "").trim() || void 0;
  const flowId = String(parsedReplyBody?.flow_id || parsedReplyBody?.flowId || "").trim() || void 0;
  const flowName = String(
    parsedReplyBody?.flow_name || parsedReplyBody?.flowName || parsedReplyBody?.flow_title || interactiveBody?.flow_name || interactiveBody?.flowName || interactiveBody?.flow_title || nfmReply?.name || ""
  ).trim() || void 0;
  return {
    flowToken,
    flowId,
    flowName,
    replyName: nfmReply?.name ? String(nfmReply.name) : void 0,
    parsedReplyBody,
    responseJson
  };
}
const conversationHistory = {};
async function handleStatusUpdates(statuses) {
  await handleStatusUpdatesWithContext(statuses, {});
}
async function handleStatusUpdatesWithContext(statuses, context) {
  const webhookReceivedAt = /* @__PURE__ */ new Date();
  const statusOwnerUserId = await resolveWebhookUserId(context);
  for (const status of statuses) {
    const messageId = status.id;
    const statusType = status.status;
    const recipientPhone = status.recipient_id;
    const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1e3) : /* @__PURE__ */ new Date();
    const firstError = status?.errors?.[0];
    const failureReason = firstError?.title || firstError?.message || firstError?.error_data?.details || "Message delivery failed";
    console.log(
      `[Webhook Status] Message ${messageId} status: ${statusType} for ${recipientPhone}`
    );
    try {
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const statusTimestamp = timestamp;
      const eventPayload = {
        userId: statusOwnerUserId || void 0,
        messageId: messageId || void 0,
        recipientId: recipientPhone || void 0,
        status: statusType || "unknown",
        statusTimestamp,
        webhookReceivedAt,
        phoneNumberId: context.phoneNumberId || void 0,
        wabaId: context.wabaId || void 0,
        conversationId: status?.conversation?.id || void 0,
        pricingCategory: status?.pricing?.category || void 0,
        errorCode: firstError?.code ? String(firstError.code) : void 0,
        errorTitle: firstError?.title || void 0,
        errorMessage: firstError?.message || void 0,
        errorDetails: firstError?.error_data?.details || void 0,
        rawStatus: status,
        updatedAt: nowIso
      };
      if (messageId) {
        await WebhookStatusEvent.findOneAndUpdate(
          {
            messageId,
            status: statusType || "unknown",
            statusTimestamp,
            recipientId: recipientPhone || null
          },
          {
            $set: eventPayload,
            $setOnInsert: {
              id: randomUUID(),
              createdAt: nowIso
            }
          },
          { upsert: true, new: true }
        );
      } else {
        await WebhookStatusEvent.create({
          id: randomUUID(),
          ...eventPayload,
          createdAt: nowIso
        });
      }
      if (statusType === "delivered") {
        await campaignService.updateCampaignContactStatus(
          messageId,
          "delivered",
          timestamp
        );
      } else if (statusType === "read") {
        await campaignService.updateCampaignContactStatus(
          messageId,
          "read",
          timestamp
        );
      } else if (statusType === "failed") {
        console.error(
          `[Webhook Status] Message ${messageId} FAILED for ${recipientPhone}:`,
          {
            code: firstError?.code,
            title: firstError?.title,
            message: firstError?.message,
            details: firstError?.error_data?.details
          }
        );
        await campaignService.updateCampaignContactStatus(
          messageId,
          "failed",
          timestamp,
          failureReason
        );
      }
      if (messageId) {
        const messageStatusMap = {
          sent: "sent",
          accepted: "sent",
          delivered: "delivered",
          read: "read",
          failed: "failed"
        };
        const mappedMessageStatus = messageStatusMap[String(statusType || "").toLowerCase()];
        if (mappedMessageStatus) {
          await Message.updateMany(
            { whatsappMessageId: messageId },
            {
              $set: {
                status: mappedMessageStatus,
                ...mappedMessageStatus === "failed" ? { failureReason } : {}
              },
              ...mappedMessageStatus !== "failed" ? { $unset: { failureReason: 1 } } : {}
            }
          );
        }
        const dripUpdate = {
          providerStatus: statusType
        };
        if (statusType === "delivered") {
          dripUpdate.status = "delivered";
          dripUpdate.deliveredAt = timestamp;
        } else if (statusType === "read") {
          dripUpdate.status = "read";
          dripUpdate.readAt = timestamp;
        } else if (statusType === "failed") {
          dripUpdate.status = "failed";
          dripUpdate.failedAt = timestamp;
          dripUpdate.error = failureReason;
        } else if (statusType === "sent") {
          dripUpdate.status = "accepted";
          dripUpdate.sentAt = timestamp;
        }
        await CampaignLog.updateMany({ messageId }, { $set: dripUpdate });
        await broadcastService.updateBroadcastLogFromWebhook(
          messageId,
          statusType,
          failureReason
        );
      }
    } catch (error) {
      console.error(`[Webhook Status] Error updating campaign status:`, error);
    }
  }
}
async function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = String(req.query["hub.verify_token"] || "");
  const challenge = req.query["hub.challenge"];
  console.log("WhatsApp webhook verification:", { mode, token, challenge });
  const hasStoredMatch = token ? await isStoredWebhookVerifyToken(token) : false;
  if (mode === "subscribe" && Boolean(token) && hasStoredMatch) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }
  console.log("Webhook verification failed");
  return res.sendStatus(403);
}
async function handleWebhook(req, res) {
  try {
    const body = req.body;
    console.log("WhatsApp webhook received:", JSON.stringify(body, null, 2));
    if (body.object !== "whatsapp_business_account") {
      return res.sendStatus(404);
    }
    const entries = Array.isArray(body.entry) ? body.entry : [];
    const messageContexts = [];
    for (const currentEntry of entries) {
      const changes = Array.isArray(currentEntry?.changes) ? currentEntry.changes : [];
      for (const change of changes) {
        const currentValue = change?.value;
        if (!currentValue) continue;
        const statuses = Array.isArray(currentValue?.statuses) ? currentValue.statuses : [];
        if (statuses.length > 0) {
          await handleStatusUpdatesWithContext(statuses, {
            phoneNumberId: currentValue?.metadata?.phone_number_id,
            wabaId: currentEntry?.id
          });
        }
        const messages2 = Array.isArray(currentValue?.messages) ? currentValue.messages : [];
        if (messages2.length > 0) {
          messageContexts.push({ entry: currentEntry, value: currentValue });
        }
      }
    }
    if (messageContexts.length === 0) {
      return res.sendStatus(200);
    }
    const selectedContext = messageContexts.find(
      (context) => context.value.messages?.some((item) => hasFlowSubmissionPayload(item))
    ) || messageContexts[0];
    const entry = selectedContext.entry;
    const value = selectedContext.value;
    const messages = Array.isArray(value?.messages) ? value.messages : [];
    const webhookPhoneNumberId = String(
      value?.metadata?.phone_number_id || ""
    ).trim();
    const resolvedUserId = await resolveWebhookUserId({
      phoneNumberId: webhookPhoneNumberId || void 0,
      wabaId: entry?.id ? String(entry.id) : void 0
    });
    const message = messages.find((item) => hasFlowSubmissionPayload(item)) || messages.find((item) => item?.type === "interactive") || messages[0];
    const from = message.from;
    const messageType = message.type;
    console.log(`[Webhook] Checking if phone ${from} is blocked...`);
    const allBlocked = await listAllBlockedContacts();
    console.log(`[Webhook] Total blocked contacts in DB: ${allBlocked.length}`);
    if (resolvedUserId) {
      console.log(
        `[Webhook] Checking block for user ${resolvedUserId}, phone ${from}`
      );
      const isBlocked = await isContactBlocked(resolvedUserId, from);
      if (isBlocked) {
        console.log(
          `[Webhook] BLOCKED! Message from blocked contact ${from} for user ${resolvedUserId}, ignoring`
        );
        return res.sendStatus(200);
      }
    } else {
      console.log(
        `[Webhook] No resolved userId, checking if phone ${from} is blocked by any user`
      );
      const blockResult = await isPhoneBlocked(from);
      if (blockResult.blocked) {
        console.log(
          `[Webhook] BLOCKED! Message from blocked contact ${from} (blocked by user ${blockResult.userId}), ignoring`
        );
        return res.sendStatus(200);
      }
    }
    console.log(
      `[Webhook] Phone ${from} is NOT blocked, proceeding with message`
    );
    let messageText = "";
    let buttonPayload = "";
    let mediaUrl = "";
    let isMediaMessage = false;
    let isFlowSubmission = false;
    let parsedFlowSubmission = null;
    if (messageType === "text") {
      messageText = message.text?.body || "";
    } else if (messageType === "button") {
      messageText = message.button?.text || "";
      buttonPayload = message.button?.payload || "";
      console.log(
        `Button response from ${from}: text="${messageText}", payload="${buttonPayload}"`
      );
    } else if (messageType === "interactive") {
      const interactive = message.interactive;
      if (hasFlowSubmissionPayload(message)) {
        isFlowSubmission = true;
        parsedFlowSubmission = parseFlowSubmissionFromMessage(message);
        messageText = parsedFlowSubmission.flowName ? `[Flow Submission] ${parsedFlowSubmission.flowName}` : "[Flow Submission]";
        buttonPayload = parsedFlowSubmission.flowToken || "";
        console.log(
          `[Webhook] Flow submission from ${from}: flow=${parsedFlowSubmission.flowName || "-"}, token=${parsedFlowSubmission.flowToken || "-"}`
        );
      } else if (interactive?.type === "button_reply") {
        messageText = interactive.button_reply?.title || "";
        buttonPayload = interactive.button_reply?.id || "";
        console.log(
          `Interactive button reply from ${from}: title="${messageText}", id="${buttonPayload}"`
        );
      } else if (interactive?.type === "list_reply") {
        messageText = interactive.list_reply?.title || "";
        buttonPayload = interactive.list_reply?.id || "";
        console.log(
          `Interactive list reply from ${from}: title="${messageText}", id="${buttonPayload}"`
        );
      } else {
        const interactiveType = String(interactive?.type || "unknown");
        messageText = `[Interactive:${interactiveType}]`;
        console.log(
          `[Webhook] Unsupported interactive type from ${from}: ${interactiveType}`,
          JSON.stringify(interactive, null, 2)
        );
      }
    } else if (messageType === "image") {
      isMediaMessage = true;
      mediaUrl = message.image?.id || "";
      const caption = message.image?.caption || "";
      messageText = caption ? `[Image] ${caption}` : "[Image message]";
      console.log(
        `Image message from ${from}: id=${mediaUrl}, caption="${caption}"`
      );
    } else if (messageType === "video") {
      isMediaMessage = true;
      mediaUrl = message.video?.id || "";
      const caption = message.video?.caption || "";
      messageText = caption ? `[Video] ${caption}` : "[Video message]";
      console.log(
        `Video message from ${from}: id=${mediaUrl}, caption="${caption}"`
      );
    } else if (messageType === "audio") {
      isMediaMessage = true;
      mediaUrl = message.audio?.id || "";
      messageText = "[Audio message]";
      console.log(`Audio message from ${from}: id=${mediaUrl}`);
    } else if (messageType === "document") {
      isMediaMessage = true;
      mediaUrl = message.document?.id || "";
      const filename = message.document?.filename || "document";
      const caption = message.document?.caption || "";
      messageText = caption ? `[Document: ${filename}] ${caption}` : `[Document: ${filename}]`;
      console.log(
        `Document message from ${from}: id=${mediaUrl}, filename="${filename}"`
      );
    } else if (messageType === "sticker") {
      isMediaMessage = true;
      mediaUrl = message.sticker?.id || "";
      messageText = "[Sticker message]";
      console.log(`Sticker message from ${from}: id=${mediaUrl}`);
    } else if (messageType === "location") {
      const lat = message.location?.latitude || 0;
      const lng = message.location?.longitude || 0;
      const name = message.location?.name || "";
      messageText = name ? `[Location: ${name}] (${lat}, ${lng})` : `[Location] (${lat}, ${lng})`;
      console.log(`Location message from ${from}: ${lat}, ${lng}`);
    } else if (messageType === "contacts") {
      const contacts = message.contacts || [];
      const contactNames = contacts.map((c) => c.name?.formatted_name || "Unknown").join(", ");
      messageText = `[Contact shared: ${contactNames}]`;
      console.log(`Contacts message from ${from}: ${contactNames}`);
    } else if (messageType === "reaction") {
      const emoji = message.reaction?.emoji || "";
      messageText = `[Reaction: ${emoji}]`;
      console.log(`Reaction from ${from}: ${emoji}`);
    } else {
      messageText = `[Unsupported message type: ${messageType}]`;
      console.log(`Unsupported message type from ${from}: ${messageType}`);
    }
    console.log(`Received ${messageType} message from ${from}: ${messageText}`);
    const whatsappMessageId = message.id || "";
    if (buttonPayload.startsWith("cflow:")) {
      try {
        const [, flowId, rawPath = ""] = buttonPayload.split(":");
        const path = rawPath.split(".").filter(Boolean).map((value2) => Number.parseInt(value2, 10));
        if (!flowId || path.some((value2) => !Number.isInteger(value2) || value2 < 0)) {
          throw new Error("Invalid conversational flow button payload");
        }
        const flowOwnerId = await flowsService.resolveConversationFlowOwner(flowId) || resolvedUserId;
        if (!flowOwnerId) {
          throw new Error(`Unable to resolve owner for conversational flow ${flowId}`);
        }
        const step = await flowsService.getConversationStep(flowOwnerId, flowId, path);
        const result = step.buttons.length ? await whatsappService.sendReplyButtonMessage(
          from,
          step.bodyText,
          step.buttons,
          flowOwnerId
        ) : await whatsappService.sendTextMessage(from, step.bodyText, flowOwnerId);
        if (!result.success) {
          throw new Error(result.error || "WhatsApp rejected the conversational reply");
        }
        await saveOutboundMessage(
          from,
          formatConversationPrompt(step.bodyText, step.buttons),
          flowOwnerId
        );
        console.log(
          `[Webhook] Conversational flow ${flowId} continued for ${from}; path=${rawPath}; messageId=${result.messageId || "-"}`
        );
      } catch (conversationError) {
        console.error("[Webhook] Conversational flow processing failed:", conversationError);
      }
    }
    const saveResult = await saveInboundMessage(
      from,
      messageText || buttonPayload,
      messageType,
      buttonPayload,
      mediaUrl,
      whatsappMessageId,
      resolvedUserId
    );
    if (saveResult.isDuplicate) {
      console.log(
        `[Webhook] Duplicate message detected (${whatsappMessageId}), skipping AI processing`
      );
      return res.sendStatus(200);
    }
    if (!saveResult.contact) {
      console.error(
        `[Webhook] Failed to create/find contact for ${from}, cannot proceed with AI processing`
      );
      return res.sendStatus(200);
    }
    if (saveResult.error) {
      console.warn(
        `[Webhook] Message save failed (${saveResult.error}), but continuing with AI processing for ${from}`
      );
    }
    const savedContact = saveResult.contact;
    console.log(
      `[Webhook] Processing message from ${from}, contact: ${savedContact.id}, hasMessage: ${!!saveResult.message}`
    );
    if (isFlowSubmission) {
      try {
        const contextMessageId = String(message?.context?.id || message?.context?.message_id || "").trim() || void 0;
        await flowResponsesService.createFlowResponse({
          userId: resolvedUserId || "system",
          contactId: savedContact?.id,
          contactPhone: from,
          contactName: savedContact?.name,
          phoneNumberId: webhookPhoneNumberId || void 0,
          wabaId: entry?.id || void 0,
          inboundMessageId: saveResult?.message?.id,
          inboundWhatsappMessageId: whatsappMessageId || void 0,
          contextMessageId,
          flowToken: parsedFlowSubmission?.flowToken,
          flowId: parsedFlowSubmission?.flowId,
          flowName: parsedFlowSubmission?.flowName,
          replyName: parsedFlowSubmission?.replyName,
          parsedReplyBody: parsedFlowSubmission?.parsedReplyBody,
          responseJson: parsedFlowSubmission?.responseJson,
          rawMessage: message,
          receivedAt: message?.timestamp ? new Date(parseInt(String(message.timestamp), 10) * 1e3) : /* @__PURE__ */ new Date()
        });
        console.log(
          `[Webhook] Stored flow submission for ${from} (flow=${parsedFlowSubmission?.flowName || "-"})`
        );
      } catch (flowStoreError) {
        console.error("[Webhook] Failed to store flow submission:", flowStoreError);
      }
      return res.sendStatus(200);
    }
    if (buttonPayload.startsWith("cflow:")) {
      return res.sendStatus(200);
    }
    if (savedContact && savedContact.id && (messageText || buttonPayload)) {
      try {
        const classificationResult = await interestClassificationService.classifyAndUpdateContact(
          messageText || buttonPayload,
          savedContact.id,
          from,
          resolvedUserId || "system"
        );
        console.log(
          `[Webhook] Interest classification for ${from}: ${classificationResult.classification.status} (${classificationResult.classification.confidence})`
        );
        if (classificationResult.triggeredCampaigns.length > 0) {
          console.log(
            `[Webhook] Triggered drip campaigns: ${classificationResult.triggeredCampaigns.join(
              ", "
            )}`
          );
        }
      } catch (classifyError) {
        console.error("[Webhook] Error classifying interest:", classifyError);
      }
    }
    if (isMediaMessage) {
      console.log(
        `Media message saved, skipping AI processing for type: ${messageType}`
      );
      return res.sendStatus(200);
    }
    if (!messageText && !buttonPayload) {
      console.log(`No processable content for message type: ${messageType}`);
      return res.sendStatus(200);
    }
    const contentForAI = messageText || buttonPayload;
    const isButtonResponse = messageType === "button" || messageType === "interactive";
    if (isButtonResponse) {
      console.log(
        `[Webhook] Button response from ${from}: "${contentForAI}" - continuing with AI processing`
      );
    }
    const autoReplyDisabled = await contactAgentService.isAutoReplyDisabled(
      from
    );
    if (autoReplyDisabled) {
      console.log(
        `[Webhook] Auto-reply manually disabled for ${from} - skipping AI response`
      );
      return res.sendStatus(200);
    }
    const contactAgentAssignment = await contactAgentService.getAgentForContact(
      from
    );
    let agentToUse = null;
    let useStoredHistory = false;
    if (contactAgentAssignment) {
      console.log(
        `[Webhook] Found assigned agent for ${from}: ${contactAgentAssignment.agentName} (${contactAgentAssignment.agentId})`
      );
      agentToUse = await getAgentById(contactAgentAssignment.agentId);
      if (agentToUse && agentToUse.isActive) {
        useStoredHistory = true;
        console.log(`[Webhook] Using assigned agent: ${agentToUse.name}`);
      } else {
        console.log(
          `[Webhook] Assigned agent not found or inactive for ${from}, clearing assignment and falling back`
        );
        await contactAgentService.removeAgentFromContact(from);
        agentToUse = null;
      }
    }
    if (!agentToUse) {
      const prefilledMapping = await prefilledTextService.findMatchingAgentForMessage(contentForAI);
      if (prefilledMapping) {
        console.log(
          `[Webhook] Found pre-filled text mapping for "${contentForAI}" -> Agent: ${prefilledMapping.agentName}`
        );
        agentToUse = await getAgentById(prefilledMapping.agentId);
        if (agentToUse && agentToUse.isActive) {
          await contactAgentService.assignAgentToContact(
            "",
            // contactId - will be set later
            from,
            prefilledMapping.agentId,
            prefilledMapping.agentName
          );
          useStoredHistory = true;
          console.log(
            `[Webhook] Auto-assigned agent ${prefilledMapping.agentName} to WhatsApp lead ${from}`
          );
        } else {
          agentToUse = null;
        }
      }
    }
    if (!agentToUse) {
      const lead = await findLeadByPhone(from);
      if (lead) {
        const mapping = await getMappingByFormId(lead.formId);
        if (mapping && mapping.isActive) {
          const mappedAgent = await getAgentById(mapping.agentId);
          if (mappedAgent && mappedAgent.isActive) {
            agentToUse = mappedAgent;
          }
        }
      }
    }
    if (!agentToUse) {
      const agents = await getAllAgents();
      agentToUse = agents.find((a) => a.isActive);
      if (agentToUse) {
        console.log(
          `[Webhook] Using fallback active agent: ${agentToUse.name}`
        );
      }
    }
    if (!agentToUse) {
      console.log("[Webhook] No active agent found - skipping AI response");
      return res.sendStatus(200);
    }
    if (!agentToUse.id || !agentToUse.name) {
      console.log(
        `[Webhook] Agent is missing required fields (id: ${agentToUse.id}, name: ${agentToUse.name}) - skipping AI response`
      );
      return res.sendStatus(200);
    }
    let recentHistory = [];
    if (useStoredHistory) {
      recentHistory = await contactAgentService.getConversationHistory(from);
      console.log(
        `[Webhook] Using stored history with ${recentHistory.length} messages for agent: ${agentToUse.name}`
      );
    } else {
      if (!conversationHistory[from]) {
        conversationHistory[from] = [];
      }
      recentHistory = conversationHistory[from].slice(-10);
    }
    const historyForAI = [
      ...recentHistory,
      { role: "user", content: contentForAI }
    ];
    let aiResponse;
    try {
      aiResponse = await generateAgentResponse(
        contentForAI,
        agentToUse,
        historyForAI.slice(0, -1),
        resolvedUserId
      );
    } catch (aiError) {
      console.error(
        `[Webhook] Error generating AI response for ${from}:`,
        aiError
      );
      return res.sendStatus(200);
    }
    if (useStoredHistory) {
      await contactAgentService.addMessageToHistory(from, "user", contentForAI);
      await contactAgentService.addMessageToHistory(
        from,
        "assistant",
        aiResponse
      );
    } else {
      conversationHistory[from].push({ role: "user", content: contentForAI });
      conversationHistory[from].push({
        role: "assistant",
        content: aiResponse
      });
    }
    await whatsappService.sendTextMessage(from, aiResponse, resolvedUserId);
    await saveOutboundMessage(from, aiResponse, resolvedUserId);
    if (agentToUse.id && agentToUse.name) {
      try {
        await contactAnalyticsService.trackAgentInteraction(
          from,
          agentToUse.id,
          agentToUse.name
        );
      } catch (trackError) {
        console.error(
          "[Webhook] Error tracking agent interaction:",
          trackError
        );
      }
    }
    (async () => {
      try {
        const contacts = await storage.getContacts();
        const contact = contacts.find((c) => {
          const contactPhone = (c.phone || "").replace(/\D/g, "");
          const normalizedFrom = from.replace(/\D/g, "");
          return contactPhone.includes(normalizedFrom) || normalizedFrom.includes(contactPhone);
        });
        if (contact) {
          const fullHistory = useStoredHistory ? await contactAgentService.getConversationHistory(from) : conversationHistory[from] || [];
          const messagesForAnalysis = fullHistory.map((m) => ({
            direction: m.role === "user" ? "inbound" : "outbound",
            content: m.content,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          }));
          await contactAnalyticsService.analyzeAndUpdateContact(
            contact.id,
            from,
            contact.name || from,
            messagesForAnalysis,
            resolvedUserId
          );
          console.log(`[Webhook] Contact analytics updated for ${from}`);
        }
      } catch (analyticsError) {
        console.error("[Webhook] Error analyzing contact:", analyticsError);
      }
    })();
    console.log(
      `AI auto-reply sent to ${from}: ${aiResponse.substring(0, 100)}...`
    );
    return res.sendStatus(200);
  } catch (error) {
    console.error("Error handling webhook:", error);
    return res.sendStatus(200);
  }
}
async function getWebhookStatusEvents(req, res) {
  try {
    const limitRaw = Number(req.query.limit || 100);
    const pageRaw = Number(req.query.page || 1);
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 100;
    const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
    const skip = (page - 1) * limit;
    const messageId = String(req.query.messageId || "").trim();
    const recipientId = String(req.query.recipientId || "").trim();
    const status = String(req.query.status || "").trim();
    const userId = getUserId(req) || void 0;
    const filter = {};
    if (userId) filter.userId = userId;
    if (messageId) {
      filter.messageId = { $regex: messageId, $options: "i" };
    }
    if (recipientId) {
      filter.recipientId = { $regex: recipientId, $options: "i" };
    }
    if (status) {
      filter.status = status;
    }
    const [events, total, summaryRows] = await Promise.all([
      WebhookStatusEvent.find(filter).sort({ statusTimestamp: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      WebhookStatusEvent.countDocuments(filter),
      WebhookStatusEvent.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);
    const summary = summaryRows.reduce(
      (acc, row) => {
        acc[String(row?._id || "unknown")] = Number(row?.count || 0);
        return acc;
      },
      {}
    );
    return res.json({
      events,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit))
      },
      summary
    });
  } catch (error) {
    console.error("[Webhook Events] Failed to fetch webhook status events:", error);
    return res.status(500).json({
      error: "Failed to fetch webhook status events",
      details: error?.message || "Unknown error"
    });
  }
}
async function getWebhookConfig(req, res) {
  try {
    const userId = getUserId(req) || void 0;
    const userCreds = userId ? await credentialsService.getDecryptedCredentials(userId) : null;
    const integrationCreds = userId ? await whatsappService.getUserWhatsAppConnectionCredentials(userId) : null;
    const verifyToken = String(
      integrationCreds?.webhookVerifyToken || userCreds?.webhookVerifyToken || ""
    ).trim();
    if (!verifyToken) {
      return res.status(404).json({
        error: "No WhatsApp connection is configured for this account"
      });
    }
    const baseUrl = resolvePublicBaseUrl(req);
    const callbackUrl = `${baseUrl}/api/whatsapp-marketing/webhook/whatsapp`;
    const isHttps = /^https:\/\//i.test(callbackUrl);
    const looksLocalhost = /localhost|127\.0\.0\.1/i.test(callbackUrl);
    return res.json({
      callbackUrl,
      verifyToken,
      hints: {
        requiresPublicHttps: !isHttps || looksLocalhost
      }
    });
  } catch (error) {
    console.error("[Webhook Config] Failed to resolve webhook config:", error);
    return res.status(500).json({
      error: "Failed to resolve webhook config",
      details: error?.message || "Unknown error"
    });
  }
}
async function findLeadByPhone(phone) {
  const leads = await getAllLeads();
  const normalizedPhone = phone.replace(/\D/g, "");
  return leads.find((lead) => {
    const leadPhone = (lead.phone || "").replace(/\D/g, "");
    return leadPhone.includes(normalizedPhone) || normalizedPhone.includes(leadPhone);
  });
}
async function saveInboundMessage(from, content, type, buttonPayload, mediaUrl, whatsappMessageId, userId) {
  if (!userId) {
    return {
      message: null,
      contact: null,
      isDuplicate: false,
      error: "Unable to resolve WhatsApp account owner"
    };
  }
  const normalizedPhone = from.replace(/\D/g, "");
  let contact = null;
  try {
    const contacts = await storage.getContacts(userId);
    contact = contacts.find((c) => {
      const contactPhone = (c.phone || "").replace(/\D/g, "");
      return contactPhone.includes(normalizedPhone) || normalizedPhone.includes(contactPhone);
    });
    if (!contact) {
      const formattedPhone = from.startsWith("+") ? from : `+${from}`;
      contact = await storage.createContact({
        userId,
        name: formattedPhone,
        phone: from,
        email: "",
        tags: ["WhatsApp"],
        notes: "Auto-created from WhatsApp message"
      });
      console.log("[Webhook] Created new contact:", contact.id, "phone:", from);
    }
  } catch (contactError) {
    console.error("[Webhook] Error finding/creating contact:", contactError);
    return {
      message: null,
      contact: null,
      isDuplicate: false,
      error: "Failed to create contact"
    };
  }
  if (whatsappMessageId) {
    try {
      const isDuplicate = Boolean(
        await Message.exists({
          userId,
          direction: "inbound",
          whatsappMessageId
        })
      );
      if (isDuplicate) {
        console.log(
          `[Webhook] Skipping duplicate message: ${whatsappMessageId}`
        );
        return { message: null, contact, isDuplicate: true };
      }
    } catch (dupCheckError) {
      console.error(
        "[Webhook] Error checking duplicates, continuing anyway:",
        dupCheckError
      );
    }
  }
  try {
    const repliedCount = await broadcastService.markBroadcastLogAsReplied(
      from,
      userId
    );
    if (repliedCount > 0) {
      console.log(
        `[Webhook] Marked ${repliedCount} broadcast logs as replied for ${from}`
      );
    }
  } catch (err) {
    console.error("[Webhook] Error marking broadcast as replied:", err);
  }
  try {
    await campaignService.markCampaignContactAsReplied(from, content);
  } catch (err) {
    console.error("[Webhook] Error marking campaign as replied:", err);
  }
  try {
    let displayContent = content;
    if (type === "button" || type === "interactive") {
      displayContent = content;
      if (buttonPayload && buttonPayload !== content && !buttonPayload.startsWith("cflow:")) {
        displayContent = `${content} [Button: ${buttonPayload}]`;
      }
    }
    const validTypes = [
      "text",
      "image",
      "video",
      "document",
      "audio",
      "sticker",
      "location",
      "contacts"
    ];
    const messageType = validTypes.includes(type) ? type : "text";
    const messageData = {
      userId: userId || void 0,
      contactId: contact.id,
      content: displayContent || `[${type} message]`,
      type: messageType,
      direction: "inbound",
      status: "read",
      mediaUrl: mediaUrl || void 0
    };
    if (whatsappMessageId) {
      messageData.whatsappMessageId = whatsappMessageId;
    }
    const message = await storage.createMessage(messageData);
    console.log(
      "Saved inbound message:",
      message.id,
      "type:",
      messageType,
      "whatsappId:",
      whatsappMessageId || "none"
    );
    await storage.updateChatInboundTime(contact.id);
    console.log("Updated chat inbound time for contact:", contact.id);
    try {
      const lead = await findLeadByPhone(from);
      let agentToUse = null;
      let source = "ai_chat";
      if (lead) {
        source = "lead_form";
        const mapping = await getMappingByFormId(lead.formId);
        if (mapping && mapping.isActive) {
          agentToUse = await getAgentById(mapping.agentId);
        }
      }
      if (!agentToUse) {
        const agents = await getAllAgents();
        agentToUse = agents.find((a) => a.isActive);
      }
      const displayName = contact.name && !contact.name.startsWith("WhatsApp ") ? contact.name : from.startsWith("+") ? from : `+${from}`;
      await aiAnalytics.createOrUpdateQualification(
        from,
        displayName,
        content,
        source,
        {
          contactId: contact.id,
          agentId: agentToUse?.id,
          agentName: agentToUse?.name
        }
      );
      console.log("Tracked AI qualification for:", from);
    } catch (analyticsError) {
      console.error("Error tracking AI qualification:", analyticsError);
    }
    return { message, contact, isDuplicate: false };
  } catch (error) {
    console.error("Error saving inbound message:", error);
    return {
      message: null,
      contact,
      isDuplicate: false,
      error: "Failed to save message"
    };
  }
}
async function saveOutboundMessage(to, content, userId) {
  try {
    const normalizedPhone = to.replace(/\D/g, "");
    const contacts = await storage.getContacts(userId || void 0);
    const contact = contacts.find((c) => {
      const contactPhone = (c.phone || "").replace(/\D/g, "");
      return contactPhone.includes(normalizedPhone) || normalizedPhone.includes(contactPhone);
    });
    if (!contact) {
      console.log("Contact not found for outbound message:", to);
      return;
    }
    const message = await storage.createMessage({
      userId: userId || void 0,
      contactId: contact.id,
      content,
      type: "text",
      direction: "outbound",
      status: "sent"
    });
    console.log("Saved outbound AI message:", message.id);
  } catch (error) {
    console.error("Error saving outbound message:", error);
  }
}
async function sendWhatsAppMessage(to, message, userId) {
  const result = await whatsappService.sendTextMessage(to, message, userId);
  if (!result.success) {
    throw new Error(result.error || "Failed to send WhatsApp message");
  }
  return result;
}
async function sendMessage(req, res) {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: "Recipient and message are required" });
    }
    const userId = getUserId(req) || void 0;
    console.log(
      `[SendMessage] User ${userId || "undefined"} sending message to ${to}: ${message.substring(0, 50)}...`
    );
    const credentials = await whatsappService.getWhatsAppCredentialsStrict(
      userId
    );
    if (!credentials) {
      return res.status(403).json({
        error: "WhatsApp credentials not configured. Please set up your API keys in Settings > API Credentials."
      });
    }
    const result = await whatsappService.sendTextMessage(to, message, userId);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to send message" });
    }
    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: error.message || "Failed to send message" });
  }
}
async function getMediaUrl(req, res) {
  try {
    const { mediaId } = req.params;
    if (!mediaId) {
      return res.status(400).json({ error: "Media ID is required" });
    }
    const userId = getUserId(req) || void 0;
    const credentials = await whatsappService.getWhatsAppCredentialsStrict(
      userId
    );
    if (!credentials) {
      return res.status(403).json({
        error: "WhatsApp credentials not configured. Please set up your API keys in Settings > API Credentials."
      });
    }
    const mediaInfoUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
    const mediaInfoResponse = await fetch(mediaInfoUrl, {
      headers: {
        Authorization: `Bearer ${credentials.token}`
      }
    });
    if (!mediaInfoResponse.ok) {
      const error = await mediaInfoResponse.text();
      console.error("WhatsApp media info error:", error);
      return res.status(404).json({ error: "Media not found or expired" });
    }
    const mediaInfo = await mediaInfoResponse.json();
    const downloadUrl = mediaInfo.url;
    const mimeType = mediaInfo.mime_type;
    console.log("[Media] Fetched media info:", {
      mediaId,
      mimeType,
      hasUrl: !!downloadUrl
    });
    const mediaResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${credentials.token}`
      }
    });
    if (!mediaResponse.ok) {
      const error = await mediaResponse.text();
      console.error("WhatsApp media download error:", error);
      return res.status(500).json({ error: "Failed to download media" });
    }
    const buffer = await mediaResponse.arrayBuffer();
    res.set("Content-Type", mimeType || "application/octet-stream");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Error fetching media:", error);
    res.status(500).json({ error: error.message || "Failed to fetch media" });
  }
}
async function getConversations(req, res) {
  try {
    const conversations = Object.entries(conversationHistory).map(
      ([phone, messages]) => ({
        phone,
        messageCount: messages.length,
        lastMessage: messages[messages.length - 1]
      })
    );
    res.json(conversations);
  } catch (error) {
    console.error("Error getting conversations:", error);
    res.status(500).json({ error: "Failed to get conversations" });
  }
}
async function getConversation(req, res) {
  try {
    const { phone } = req.params;
    const messages = conversationHistory[phone] || [];
    res.json({ phone, messages });
  } catch (error) {
    console.error("Error getting conversation:", error);
    res.status(500).json({ error: "Failed to get conversation" });
  }
}
async function sendTemplateMessage(to, templateName, languageCode = "en", components = [], namedParams, userId) {
  if (!userId) {
    throw new Error("WhatsApp credentials not configured");
  }
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode
      }
    }
  };
  if (namedParams && Object.keys(namedParams).length > 0) {
    payload.template.components = [
      {
        type: "body",
        parameters: Object.entries(namedParams).map(([paramName, value]) => ({
          type: "text",
          parameter_name: paramName,
          text: value
        }))
      }
    ];
  } else if (components && components.length > 0) {
    payload.template.components = components;
  }
  console.log(
    `[WhatsApp] Sending template "${templateName}" to ${to}:`,
    JSON.stringify(payload, null, 2)
  );
  const result = await whatsappService.sendTemplateMessage(
    to,
    templateName,
    languageCode,
    payload.template.components || [],
    userId
  );
  if (!result.success) {
    throw new Error(result.error || "Failed to send template");
  }
  return result;
}
async function sendTemplateMessageEndpoint(req, res) {
  try {
    const { to, templateName, languageCode, components, namedParams } = req.body;
    if (!to || !templateName) {
      return res.status(400).json({ error: "Recipient (to) and templateName are required" });
    }
    const userId = getUserId(req) || void 0;
    const credentials = await whatsappService.getWhatsAppCredentialsStrict(
      userId
    );
    if (!credentials) {
      return res.status(403).json({
        error: "WhatsApp credentials not configured. Please set up your API keys in Settings > API Credentials."
      });
    }
    const resolvedLangCode = languageCode || "en";
    const sendResult = await whatsappService.sendTemplateMessage(
      to,
      templateName,
      resolvedLangCode,
      components || [],
      userId
    );
    if (!sendResult.success) {
      throw new Error(sendResult.error || "Failed to send template");
    }
    try {
      const normalizedPhone = to.replace(/\D/g, "");
      const contacts = await storage.getContacts(userId);
      let contact = contacts.find((c) => {
        const contactPhone = (c.phone || "").replace(/\D/g, "");
        return contactPhone.includes(normalizedPhone) || normalizedPhone.includes(contactPhone);
      });
      if (!contact) {
        const formattedPhone = to.startsWith("+") ? to : `+${to}`;
        contact = await storage.createContact({
          userId,
          name: formattedPhone,
          phone: to,
          email: "",
          tags: ["WhatsApp"],
          notes: "Auto-created from template message"
        });
      }
      await storage.createMessage({
        userId,
        contactId: contact.id,
        content: `[Template: ${templateName}]`,
        type: "text",
        direction: "outbound",
        status: "sent"
      });
    } catch (err) {
      console.error("Error saving outbound message:", err);
    }
    res.json({ success: true, messageId: sendResult.messageId });
  } catch (error) {
    console.error("Error sending template:", error);
    res.status(500).json({ error: error.message || "Failed to send template" });
  }
}
export {
  getConversation,
  getConversations,
  getMediaUrl,
  getWebhookConfig,
  getWebhookStatusEvents,
  handleWebhook,
  sendMessage,
  sendTemplateMessage,
  sendTemplateMessageEndpoint,
  verifyWebhook
};
