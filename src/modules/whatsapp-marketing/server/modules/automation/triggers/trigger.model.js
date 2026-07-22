import mongoose, { Schema } from "mongoose";
const TriggerConditionSchema = new Schema({
  field: { type: String, required: true },
  operator: { type: String, enum: ["equals", "not_equals", "contains", "not_contains", "greater_than", "less_than", "in", "not_in", "exists", "not_exists", "regex"], required: true },
  value: { type: Schema.Types.Mixed },
  dataType: { type: String, enum: ["string", "number", "boolean", "date", "array"] }
}, { _id: false });
const TriggerConditionGroupSchema = new Schema({
  logic: { type: String, enum: ["AND", "OR"], required: true },
  conditions: { type: [Schema.Types.Mixed], default: [] }
}, { _id: false });
const TriggerActionSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ["send_whatsapp", "send_template", "assign_group", "update_crm", "api_call", "internal_alert", "start_flow", "add_tag", "remove_tag", "update_score", "send_email", "delay"], required: true },
  config: { type: Schema.Types.Mixed, default: {} },
  order: { type: Number, default: 0 },
  onSuccess: { type: String },
  onFailure: { type: String }
}, { _id: false });
const TriggerScheduleSchema = new Schema({
  enabled: { type: Boolean, default: false },
  timezone: { type: String, default: "UTC" },
  daysOfWeek: { type: [Number] },
  startTime: { type: String },
  endTime: { type: String },
  blackoutDates: { type: [Date] }
}, { _id: false });
const TriggerThrottleSchema = new Schema({
  enabled: { type: Boolean, default: false },
  maxExecutions: { type: Number, default: 100 },
  windowSeconds: { type: Number, default: 3600 },
  perContact: { type: Boolean, default: false }
}, { _id: false });
const TriggerSchema = new Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ["active", "paused", "draft"], default: "draft" },
  eventSource: { type: String, enum: ["webhook", "whatsapp_message", "whatsapp_status", "facebook_lead", "crm_update", "contact_created", "contact_updated", "tag_added", "segment_joined", "flow_completed", "campaign_event", "api_event", "scheduled"], required: true },
  eventType: { type: String },
  conditionGroup: { type: TriggerConditionGroupSchema, default: { logic: "AND", conditions: [] } },
  actions: { type: [TriggerActionSchema], default: [] },
  schedule: { type: TriggerScheduleSchema },
  throttle: { type: TriggerThrottleSchema },
  priority: { type: Number, default: 0 },
  tags: { type: [String], default: [] },
  executionCount: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  lastExecutedAt: { type: Date }
}, { timestamps: true });
TriggerSchema.index({ userId: 1, status: 1 });
TriggerSchema.index({ userId: 1, eventSource: 1, status: 1 });
const Trigger = mongoose.models.Trigger || mongoose.model("Trigger", TriggerSchema);
const TriggerExecutionSchema = new Schema({
  triggerId: { type: Schema.Types.ObjectId, ref: "Trigger", required: true, index: true },
  userId: { type: String, required: true, index: true },
  eventId: { type: String, required: true },
  eventSource: { type: String, required: true },
  eventData: { type: Schema.Types.Mixed, default: {} },
  contactId: { type: String, index: true },
  status: { type: String, enum: ["pending", "running", "completed", "failed", "partial"], default: "pending" },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  actionResults: [{
    actionId: { type: String, required: true },
    actionType: { type: String, required: true },
    status: { type: String, enum: ["success", "failed", "skipped"], required: true },
    result: { type: Schema.Types.Mixed },
    error: { type: String },
    executedAt: { type: Date, required: true },
    duration: { type: Number, required: true }
  }],
  error: { type: String },
  metadata: { type: Schema.Types.Mixed }
}, { timestamps: true });
TriggerExecutionSchema.index({ triggerId: 1, createdAt: -1 });
TriggerExecutionSchema.index({ userId: 1, createdAt: -1 });
TriggerExecutionSchema.index({ userId: 1, status: 1 });
const TriggerExecution = mongoose.models.TriggerExecution || mongoose.model("TriggerExecution", TriggerExecutionSchema);
const RealTimeEventSchema = new Schema({
  userId: { type: String, required: true, index: true },
  eventId: { type: String, required: true, unique: true },
  sourceType: { type: String, enum: ["webhook", "whatsapp", "facebook", "crm", "api", "system", "scheduled"], required: true },
  sourceId: { type: String },
  eventType: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, default: {} },
  normalizedData: { type: Schema.Types.Mixed, default: {} },
  contactId: { type: String, index: true },
  receivedAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
  triggerMatches: [{ type: Schema.Types.ObjectId, ref: "Trigger" }],
  status: { type: String, enum: ["received", "processing", "processed", "failed"], default: "received" }
}, { timestamps: true });
RealTimeEventSchema.index({ userId: 1, receivedAt: -1 });
RealTimeEventSchema.index({ userId: 1, sourceType: 1, receivedAt: -1 });
const RealTimeEvent = mongoose.models.RealTimeEvent || mongoose.model("RealTimeEvent", RealTimeEventSchema);
export {
  RealTimeEvent,
  Trigger,
  TriggerExecution
};
