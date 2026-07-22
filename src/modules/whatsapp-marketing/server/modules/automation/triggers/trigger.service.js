import { Trigger, TriggerExecution, RealTimeEvent } from "./trigger.model.js";
import { randomUUID } from "crypto";
const uuidv4 = () => randomUUID();
async function createTrigger(userId, data) {
  const trigger = new Trigger({
    ...data,
    userId,
    status: data.status || "draft"
  });
  return trigger.save();
}
async function getTriggerById(userId, triggerId) {
  return Trigger.findOne({ _id: triggerId, userId });
}
async function getTriggers(userId, filters) {
  const query = { userId };
  if (filters?.status) query.status = filters.status;
  if (filters?.eventSource) query.eventSource = filters.eventSource;
  if (filters?.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: "i" } },
      { description: { $regex: filters.search, $options: "i" } }
    ];
  }
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;
  const skip = (page - 1) * limit;
  const [triggers, total] = await Promise.all([
    Trigger.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Trigger.countDocuments(query)
  ]);
  return { triggers, total };
}
async function updateTrigger(userId, triggerId, data) {
  return Trigger.findOneAndUpdate(
    { _id: triggerId, userId },
    { $set: data },
    { new: true }
  );
}
async function deleteTrigger(userId, triggerId) {
  const result = await Trigger.deleteOne({ _id: triggerId, userId });
  return result.deletedCount > 0;
}
async function activateTrigger(userId, triggerId) {
  return Trigger.findOneAndUpdate(
    { _id: triggerId, userId },
    { $set: { status: "active" } },
    { new: true }
  );
}
async function pauseTrigger(userId, triggerId) {
  return Trigger.findOneAndUpdate(
    { _id: triggerId, userId },
    { $set: { status: "paused" } },
    { new: true }
  );
}
async function duplicateTrigger(userId, triggerId) {
  const original = await Trigger.findOne({ _id: triggerId, userId });
  if (!original) return null;
  const duplicate = new Trigger({
    ...original.toObject(),
    _id: void 0,
    name: `${original.name} (Copy)`,
    status: "draft",
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    lastExecutedAt: void 0,
    createdAt: void 0,
    updatedAt: void 0
  });
  return duplicate.save();
}
function evaluateConditionGroup(conditionGroup, data) {
  const { logic, conditions } = conditionGroup;
  if (conditions.length === 0) return true;
  const results = conditions.map((condition) => {
    if ("logic" in condition) {
      return evaluateConditionGroup(condition, data);
    }
    return evaluateCondition(condition, data);
  });
  return logic === "AND" ? results.every((r) => r) : results.some((r) => r);
}
function evaluateCondition(condition, data) {
  const { field, operator, value } = condition;
  const fieldValue = getNestedValue(data, field);
  switch (operator) {
    case "equals":
      return fieldValue === value;
    case "not_equals":
      return fieldValue !== value;
    case "contains":
      return String(fieldValue || "").toLowerCase().includes(String(value || "").toLowerCase());
    case "not_contains":
      return !String(fieldValue || "").toLowerCase().includes(String(value || "").toLowerCase());
    case "greater_than":
      return Number(fieldValue) > Number(value);
    case "less_than":
      return Number(fieldValue) < Number(value);
    case "in":
      return Array.isArray(value) && value.includes(fieldValue);
    case "not_in":
      return Array.isArray(value) && !value.includes(fieldValue);
    case "exists":
      return fieldValue !== void 0 && fieldValue !== null;
    case "not_exists":
      return fieldValue === void 0 || fieldValue === null;
    case "regex":
      try {
        return new RegExp(value, "i").test(String(fieldValue || ""));
      } catch {
        return false;
      }
    default:
      return false;
  }
}
function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}
async function getActiveTriggersByEvent(userId, eventSource, eventType) {
  const query = {
    userId,
    status: "active",
    eventSource
  };
  if (eventType) {
    query.$or = [
      { eventType },
      { eventType: { $exists: false } },
      { eventType: null }
    ];
  }
  return Trigger.find(query).sort({ priority: -1 });
}
async function processEvent(userId, event) {
  const eventId = uuidv4();
  const realTimeEvent = new RealTimeEvent({
    userId,
    eventId,
    sourceType: event.sourceType,
    eventType: event.eventType,
    payload: event.payload,
    normalizedData: normalizeEventData(event),
    contactId: event.contactId,
    status: "processing"
  });
  await realTimeEvent.save();
  const activeTriggers = await getActiveTriggersByEvent(userId, event.sourceType, event.eventType);
  const matchedTriggers = [];
  for (const trigger of activeTriggers) {
    if (evaluateConditionGroup(trigger.conditionGroup, realTimeEvent.normalizedData)) {
      matchedTriggers.push(trigger);
    }
  }
  realTimeEvent.triggerMatches = matchedTriggers.map((t) => t._id);
  realTimeEvent.status = "processed";
  realTimeEvent.processedAt = /* @__PURE__ */ new Date();
  await realTimeEvent.save();
  let executionsStarted = 0;
  for (const trigger of matchedTriggers) {
    try {
      await startTriggerExecution(trigger, realTimeEvent);
      executionsStarted++;
    } catch (error) {
      console.error(`[Triggers] Failed to start execution for trigger ${trigger._id}:`, error);
    }
  }
  return { eventId, triggersMatched: matchedTriggers.length, executionsStarted };
}
function normalizeEventData(event) {
  return {
    sourceType: event.sourceType,
    eventType: event.eventType,
    contactId: event.contactId,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...event.payload
  };
}
async function startTriggerExecution(trigger, event) {
  const execution = new TriggerExecution({
    triggerId: trigger._id,
    userId: trigger.userId,
    eventId: event.eventId,
    eventSource: event.sourceType,
    eventData: event.normalizedData,
    contactId: event.contactId,
    status: "running"
  });
  await execution.save();
  await Trigger.updateOne(
    { _id: trigger._id },
    {
      $inc: { executionCount: 1 },
      $set: { lastExecutedAt: /* @__PURE__ */ new Date() }
    }
  );
  executeActionsAsync(trigger, execution, event);
  return execution;
}
async function executeActionsAsync(trigger, execution, event) {
  const sortedActions = [...trigger.actions].sort((a, b) => a.order - b.order);
  let hasFailure = false;
  for (const action of sortedActions) {
    const startTime = Date.now();
    try {
      const result = await executeAction(action, event.normalizedData, trigger.userId);
      execution.actionResults.push({
        actionId: action.id,
        actionType: action.type,
        status: "success",
        result,
        executedAt: /* @__PURE__ */ new Date(),
        duration: Date.now() - startTime
      });
    } catch (error) {
      hasFailure = true;
      execution.actionResults.push({
        actionId: action.id,
        actionType: action.type,
        status: "failed",
        error: error.message,
        executedAt: /* @__PURE__ */ new Date(),
        duration: Date.now() - startTime
      });
    }
  }
  execution.status = hasFailure ? "partial" : "completed";
  execution.completedAt = /* @__PURE__ */ new Date();
  await execution.save();
  await Trigger.updateOne(
    { _id: trigger._id },
    {
      $inc: hasFailure ? { failureCount: 1 } : { successCount: 1 }
    }
  );
}
async function executeAction(action, eventData, userId) {
  const { type, config } = action;
  switch (type) {
    case "send_whatsapp":
      return { message: "WhatsApp message queued", config };
    case "send_template":
      return { message: "Template message queued", config };
    case "assign_group":
      return { message: "Contact assigned to group", groupId: config.groupId };
    case "update_crm":
      return { message: "CRM field updated", field: config.field, value: config.value };
    case "api_call":
      return { message: "API call queued", url: config.url };
    case "internal_alert":
      return { message: "Alert sent", alertType: config.alertType };
    case "start_flow":
      return { message: "Flow started", flowId: config.flowId };
    case "add_tag":
      return { message: "Tag added", tag: config.tag };
    case "remove_tag":
      return { message: "Tag removed", tag: config.tag };
    case "update_score":
      return { message: "Score updated", scoreChange: config.scoreChange };
    case "send_email":
      return { message: "Email queued", to: config.to };
    case "delay":
      await new Promise((resolve) => setTimeout(resolve, Math.min(config.delayMs || 1e3, 6e4)));
      return { message: "Delay completed", delayMs: config.delayMs };
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}
async function getTriggerExecutions(userId, triggerId, filters) {
  const query = { userId };
  if (triggerId) query.triggerId = triggerId;
  if (filters?.status) query.status = filters.status;
  if (filters?.startDate || filters?.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = filters.startDate;
    if (filters.endDate) query.createdAt.$lte = filters.endDate;
  }
  const page = filters?.page || 1;
  const limit = filters?.limit || 50;
  const skip = (page - 1) * limit;
  const [executions, total] = await Promise.all([
    TriggerExecution.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    TriggerExecution.countDocuments(query)
  ]);
  return { executions, total };
}
async function getRecentActivity(userId, limit = 20) {
  return RealTimeEvent.find({ userId }).sort({ receivedAt: -1 }).limit(limit).populate("triggerMatches", "name status");
}
async function getTriggerStats(userId) {
  const [totalTriggers, activeTriggers, triggers] = await Promise.all([
    Trigger.countDocuments({ userId }),
    Trigger.countDocuments({ userId, status: "active" }),
    Trigger.find({ userId }).select("executionCount successCount failureCount")
  ]);
  const totalExecutions = triggers.reduce((sum, t) => sum + t.executionCount, 0);
  const totalSuccesses = triggers.reduce((sum, t) => sum + t.successCount, 0);
  const successRate = totalExecutions > 0 ? totalSuccesses / totalExecutions * 100 : 0;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  const recentExecutions = await TriggerExecution.countDocuments({
    userId,
    createdAt: { $gte: oneDayAgo }
  });
  return {
    totalTriggers,
    activeTriggers,
    totalExecutions,
    successRate: Math.round(successRate * 100) / 100,
    recentExecutions
  };
}
export {
  activateTrigger,
  createTrigger,
  deleteTrigger,
  duplicateTrigger,
  evaluateConditionGroup,
  getActiveTriggersByEvent,
  getRecentActivity,
  getTriggerById,
  getTriggerExecutions,
  getTriggerStats,
  getTriggers,
  pauseTrigger,
  processEvent,
  updateTrigger
};
