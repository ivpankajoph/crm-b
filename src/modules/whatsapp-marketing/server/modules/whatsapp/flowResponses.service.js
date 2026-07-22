import { randomUUID } from "crypto";
import { Types } from "mongoose";
import { WhatsAppFlowResponse } from "./flowResponses.model.js";
import { WhatsAppFlowMessageLog } from "./flowMessageLog.model.js";
async function createFlowResponse(input) {
  const linkedSend = !input.flowId && (input.contextMessageId || input.flowToken) ? await WhatsAppFlowMessageLog.findOne({
    userId: String(input.userId || "system"),
    $or: [
      ...input.contextMessageId ? [{ messageId: input.contextMessageId }] : [],
      ...input.flowToken ? [{ flowToken: input.flowToken }] : []
    ]
  }).sort({ attemptedAt: -1 }).lean() : null;
  const payload = {
    id: randomUUID(),
    userId: String(input.userId || "system"),
    contactId: input.contactId || void 0,
    contactPhone: String(input.contactPhone || ""),
    contactName: input.contactName || void 0,
    phoneNumberId: input.phoneNumberId || void 0,
    wabaId: input.wabaId || void 0,
    inboundMessageId: input.inboundMessageId || void 0,
    inboundWhatsappMessageId: input.inboundWhatsappMessageId || void 0,
    contextMessageId: input.contextMessageId || void 0,
    flowToken: input.flowToken || void 0,
    flowId: input.flowId || linkedSend?.flowId || void 0,
    flowName: input.flowName || linkedSend?.flowName || void 0,
    replyName: input.replyName || void 0,
    responseJson: input.responseJson || void 0,
    parsedReplyBody: input.parsedReplyBody || void 0,
    rawMessage: input.rawMessage || {},
    receivedAt: input.receivedAt || /* @__PURE__ */ new Date()
  };
  return WhatsAppFlowResponse.create(payload);
}
async function listFlowResponses(userId, filters) {
  const query = {
    userId: filters?.includeSystem ? { $in: [userId, "system"] } : userId
  };
  if (filters?.search && filters.search.trim()) {
    const escaped = filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { contactPhone: { $regex: escaped, $options: "i" } },
      { contactName: { $regex: escaped, $options: "i" } },
      { flowName: { $regex: escaped, $options: "i" } },
      { flowId: { $regex: escaped, $options: "i" } },
      { flowToken: { $regex: escaped, $options: "i" } }
    ];
  }
  if (filters?.flowName && filters.flowName.trim()) {
    query.flowName = filters.flowName.trim();
  }
  if (filters?.flowId && filters.flowId.trim()) {
    query.flowId = filters.flowId.trim();
  }
  if (filters?.contactPhone && filters.contactPhone.trim()) {
    query.contactPhone = { $regex: filters.contactPhone.trim(), $options: "i" };
  }
  const start = filters?.start ? new Date(filters.start) : void 0;
  const end = filters?.end ? new Date(filters.end) : void 0;
  if (start && !Number.isNaN(start.getTime()) || end && !Number.isNaN(end.getTime())) {
    query.receivedAt = {};
    if (start && !Number.isNaN(start.getTime())) {
      query.receivedAt.$gte = start;
    }
    if (end && !Number.isNaN(end.getTime())) {
      query.receivedAt.$lte = end;
    }
  }
  const page = Math.max(1, Number(filters?.page || 1));
  const limit = Math.max(1, Math.min(100, Number(filters?.limit || 50)));
  const [responses, total] = await Promise.all([
    WhatsAppFlowResponse.find(query).sort({ receivedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    WhatsAppFlowResponse.countDocuments(query)
  ]);
  return { responses, total };
}
async function getFlowResponseById(userId, id) {
  const query = { userId };
  if (Types.ObjectId.isValid(id)) {
    query.$or = [{ _id: new Types.ObjectId(id) }, { id }];
  } else {
    query.id = id;
  }
  return WhatsAppFlowResponse.findOne(query);
}
async function getFlowResponseSummaryByFlow(userId, options) {
  const match = {
    userId: options?.includeSystem ? { $in: [userId, "system"] } : userId
  };
  const rows = await WhatsAppFlowResponse.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          flowId: { $ifNull: ["$flowId", ""] },
          flowName: { $ifNull: ["$flowName", ""] }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
  const flows = rows.map((row) => ({
    flowId: row?._id?.flowId ? String(row._id.flowId) : void 0,
    flowName: row?._id?.flowName ? String(row._id.flowName) : void 0,
    count: Number(row?.count || 0)
  }));
  const total = flows.reduce((sum, row) => sum + row.count, 0);
  return { total, flows };
}
export {
  createFlowResponse,
  getFlowResponseById,
  getFlowResponseSummaryByFlow,
  listFlowResponses
};
