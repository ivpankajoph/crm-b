import { randomUUID } from "crypto";
import { Types } from "mongoose";
import { WebhookStatusEvent } from "../storage/mongodb.adapter.js";
import { WhatsAppFlow } from "./flows.model.js";
import { WhatsAppFlowMessageLog } from "./flowMessageLog.model.js";
import { WhatsAppFlowResponse } from "./flowResponses.model.js";
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const dateRange = (fromDate, toDate) => {
  const range = {};
  if (fromDate) {
    const from = new Date(fromDate);
    if (!Number.isNaN(from.getTime())) range.$gte = from;
  }
  if (toDate) {
    const to = new Date(toDate);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      range.$lte = to;
    }
  }
  return Object.keys(range).length ? range : void 0;
};
async function logFlowSend(input) {
  const now = /* @__PURE__ */ new Date();
  return WhatsAppFlowMessageLog.create({
    id: randomUUID(),
    ...input,
    status: input.success ? "accepted" : "failed",
    attemptedAt: now,
    acceptedAt: input.success ? now : void 0,
    failedAt: input.success ? void 0 : now
  });
}
async function listFlowReports(userId, filters) {
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.max(1, Math.min(100, Number(filters.limit || 10)));
  const flowQuery = { userId };
  if (filters.search?.trim()) {
    const pattern = new RegExp(escapeRegex(filters.search.trim()), "i");
    flowQuery.$or = [{ name: pattern }, { flowId: pattern }];
  }
  if (filters.status && filters.status !== "all") {
    flowQuery.status = filters.status.toUpperCase();
  }
  const sortField = ["name", "createdAt", "updatedAt"].includes(String(filters.sortBy)) ? String(filters.sortBy) : "createdAt";
  const sortDirection = filters.sortOrder === "asc" ? 1 : -1;
  const [flows, total] = await Promise.all([
    WhatsAppFlow.find(flowQuery).sort({ [sortField]: sortDirection }).skip((page - 1) * limit).limit(limit).lean(),
    WhatsAppFlow.countDocuments(flowQuery)
  ]);
  const ids = flows.map((flow) => String(flow.flowId));
  const range = dateRange(filters.fromDate, filters.toDate);
  const sendMatch = { userId, flowId: { $in: ids } };
  const responseMatch = { userId, flowId: { $in: ids } };
  if (range) {
    sendMatch.attemptedAt = range;
    responseMatch.receivedAt = range;
  }
  const [sendRows, responseRows] = await Promise.all([
    ids.length ? WhatsAppFlowMessageLog.aggregate([
      { $match: sendMatch },
      {
        $group: {
          _id: "$flowId",
          attempted: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          uniqueRecipients: { $addToSet: "$contactPhone" },
          firstSentAt: { $min: "$attemptedAt" },
          lastSentAt: { $max: "$attemptedAt" },
          messageIds: { $addToSet: "$messageId" }
        }
      }
    ]) : [],
    ids.length ? WhatsAppFlowResponse.aggregate([
      { $match: responseMatch },
      {
        $group: {
          _id: "$flowId",
          responses: { $sum: 1 },
          uniqueResponders: { $addToSet: "$contactPhone" },
          firstResponseAt: { $min: "$receivedAt" },
          lastResponseAt: { $max: "$receivedAt" }
        }
      }
    ]) : []
  ]);
  const sendByFlow = new Map(sendRows.map((row) => [String(row._id), row]));
  const responseByFlow = new Map(responseRows.map((row) => [String(row._id), row]));
  const messageIds = sendRows.flatMap(
    (row) => (row.messageIds || []).filter(Boolean).map(String)
  );
  const statusRows = messageIds.length ? await WebhookStatusEvent.find({ messageId: { $in: messageIds } }).lean() : [];
  const latestStatus = /* @__PURE__ */ new Map();
  for (const row of statusRows) {
    const id = String(row.messageId || "");
    const previous = latestStatus.get(id);
    if (!previous || new Date(row.statusTimestamp).getTime() >= new Date(previous.statusTimestamp).getTime()) {
      latestStatus.set(id, row);
    }
  }
  const data = flows.map((flow) => {
    const send = sendByFlow.get(String(flow.flowId)) || {};
    const response = responseByFlow.get(String(flow.flowId)) || {};
    const statuses = (send.messageIds || []).filter(Boolean).map((id) => latestStatus.get(String(id))).filter(Boolean);
    return {
      ...flow,
      reportMetrics: {
        attempted: Number(send.attempted || 0),
        accepted: Number(send.accepted || 0),
        delivered: statuses.filter((row) => ["delivered", "read"].includes(row.status)).length,
        read: statuses.filter((row) => row.status === "read").length,
        failed: Number(send.failed || 0) + statuses.filter((row) => row.status === "failed").length,
        responses: Number(response.responses || 0),
        totalConversations: (/* @__PURE__ */ new Set([
          ...send.uniqueRecipients || [],
          ...response.uniqueResponders || []
        ])).size,
        uniqueRecipients: (send.uniqueRecipients || []).length,
        uniqueResponders: (response.uniqueResponders || []).length,
        firstSentAt: send.firstSentAt || null,
        lastSentAt: send.lastSentAt || null,
        firstResponseAt: response.firstResponseAt || null,
        lastResponseAt: response.lastResponseAt || null
      }
    };
  });
  return { data, meta: { total, page, limit } };
}
async function getFlowReportDetails(userId, id, filters) {
  const flow = await WhatsAppFlow.findOne({
    userId,
    ...Types.ObjectId.isValid(id) ? { $or: [{ _id: new Types.ObjectId(id) }, { flowId: id }] } : { flowId: id }
  }).lean();
  if (!flow) return null;
  const range = dateRange(filters?.fromDate, filters?.toDate);
  const sendQuery = { userId, flowId: flow.flowId };
  const responseQuery = { userId, flowId: flow.flowId };
  if (range) {
    sendQuery.attemptedAt = range;
    responseQuery.receivedAt = range;
  }
  if (filters?.search?.trim()) {
    const pattern = new RegExp(escapeRegex(filters.search.trim()), "i");
    sendQuery.$or = [
      { contactPhone: pattern },
      { contactName: pattern },
      { messageId: pattern },
      { flowToken: pattern }
    ];
    responseQuery.$or = [
      { contactPhone: pattern },
      { contactName: pattern },
      { flowToken: pattern },
      { inboundWhatsappMessageId: pattern }
    ];
  }
  const [sends, responses] = await Promise.all([
    WhatsAppFlowMessageLog.find(sendQuery).sort({ attemptedAt: -1 }).lean(),
    WhatsAppFlowResponse.find(responseQuery).sort({ receivedAt: -1 }).lean()
  ]);
  const messageIds = sends.map((row) => row.messageId).filter(Boolean).map(String);
  const events = messageIds.length ? await WebhookStatusEvent.find({ messageId: { $in: messageIds } }).sort({ statusTimestamp: 1, webhookReceivedAt: 1 }).lean() : [];
  const eventsByMessage = /* @__PURE__ */ new Map();
  for (const event of events) {
    const key = String(event.messageId || "");
    eventsByMessage.set(key, [...eventsByMessage.get(key) || [], event]);
  }
  const usedResponseIds = /* @__PURE__ */ new Set();
  const conversations = sends.map((send) => {
    const response = responses.find((item) => {
      const itemId = String(item._id);
      if (usedResponseIds.has(itemId)) return false;
      return send.messageId && item.contextMessageId === send.messageId || send.flowToken && item.flowToken === send.flowToken || item.contactPhone === send.contactPhone;
    });
    if (response) usedResponseIds.add(String(response._id));
    const timeline = [
      {
        type: "attempted",
        status: "attempted",
        at: send.attemptedAt,
        detail: "Flow send attempted"
      },
      {
        type: "provider",
        status: send.status,
        at: send.acceptedAt || send.failedAt || send.attemptedAt,
        detail: send.error || "Meta accepted the Flow message"
      },
      ...(eventsByMessage.get(String(send.messageId || "")) || []).map((event) => ({
        type: "webhook",
        status: event.status,
        at: event.statusTimestamp || event.webhookReceivedAt,
        detail: event.errorMessage || event.errorDetails || `Message ${event.status}`,
        conversationId: event.conversationId || null,
        pricingCategory: event.pricingCategory || null
      })),
      ...response ? [
        {
          type: "response",
          status: "responded",
          at: response.receivedAt,
          detail: "Customer submitted the Flow"
        }
      ] : []
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    const lastAt = timeline.length ? timeline[timeline.length - 1].at : send.attemptedAt;
    return {
      send,
      response: response || null,
      timeline,
      durationMinutes: Math.max(
        0,
        Math.round(
          (new Date(lastAt).getTime() - new Date(send.attemptedAt).getTime()) / 6e4 * 100
        ) / 100
      )
    };
  });
  for (const response of responses) {
    if (usedResponseIds.has(String(response._id))) continue;
    conversations.push({
      send: null,
      response,
      timeline: [
        {
          type: "response",
          status: "responded",
          at: response.receivedAt,
          detail: "Customer Flow response received (send log unavailable)"
        }
      ],
      durationMinutes: 0
    });
  }
  return {
    flow,
    totals: {
      attempted: sends.length,
      accepted: sends.filter((row) => row.status === "accepted").length,
      failed: sends.filter((row) => row.status === "failed").length,
      delivered: events.filter((row) => ["delivered", "read"].includes(row.status)).length,
      read: events.filter((row) => row.status === "read").length,
      responses: responses.length,
      totalConversations: (/* @__PURE__ */ new Set([
        ...sends.map((row) => row.contactPhone),
        ...responses.map((row) => row.contactPhone)
      ])).size,
      webhookEvents: events.length
    },
    conversations
  };
}
export {
  getFlowReportDetails,
  listFlowReports,
  logFlowSend
};
