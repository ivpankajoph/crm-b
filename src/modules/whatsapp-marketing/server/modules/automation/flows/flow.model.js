import mongoose, { Schema } from "mongoose";
const FlowNodeSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ["start", "message", "template", "delay", "condition", "split", "merge", "api_call", "webhook", "add_tag", "remove_tag", "update_property", "update_score", "assign_agent", "assign_group", "ai_response", "wait_for_reply", "goto", "end"], required: true },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  data: {
    label: { type: String, required: true },
    config: { type: Schema.Types.Mixed, default: {} }
  }
}, { _id: false });
const FlowEdgeSchema = new Schema({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  sourceHandle: { type: String },
  targetHandle: { type: String },
  label: { type: String },
  condition: {
    field: { type: String },
    operator: { type: String },
    value: { type: Schema.Types.Mixed }
  }
}, { _id: false });
const FlowVariableSchema = new Schema({
  key: { type: String, required: true },
  type: { type: String, enum: ["string", "number", "boolean", "date", "object", "array"], required: true },
  defaultValue: { type: Schema.Types.Mixed },
  source: { type: String, enum: ["contact", "trigger", "input", "api"] },
  description: { type: String }
}, { _id: false });
const FlowDefinitionSchema = new Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  version: { type: Number, default: 1 },
  status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
  nodes: { type: [FlowNodeSchema], default: [] },
  edges: { type: [FlowEdgeSchema], default: [] },
  variables: { type: [FlowVariableSchema], default: [] },
  entryPoints: [{
    type: { type: String, enum: ["manual", "trigger", "scheduled", "api"], required: true },
    triggerId: { type: String },
    schedule: {
      cronExpression: { type: String },
      timezone: { type: String }
    }
  }],
  settings: {
    allowMultipleInstances: { type: Boolean, default: true },
    maxConcurrentInstances: { type: Number, default: 100 },
    timeout: { type: Number, default: 864e5 },
    retryOnFailure: { type: Boolean, default: false },
    maxRetries: { type: Number, default: 3 }
  },
  tags: { type: [String], default: [] },
  publishedAt: { type: Date },
  totalInstances: { type: Number, default: 0 },
  activeInstances: { type: Number, default: 0 },
  completedInstances: { type: Number, default: 0 },
  failedInstances: { type: Number, default: 0 }
}, { timestamps: true });
FlowDefinitionSchema.index({ userId: 1, status: 1 });
FlowDefinitionSchema.index({ userId: 1, name: 1 });
const FlowDefinition = mongoose.models.FlowDefinition || mongoose.model("FlowDefinition", FlowDefinitionSchema);
const FlowInstanceSchema = new Schema({
  flowId: { type: Schema.Types.ObjectId, ref: "FlowDefinition", required: true, index: true },
  flowVersion: { type: Number, required: true },
  userId: { type: String, required: true, index: true },
  contactId: { type: String, index: true },
  status: { type: String, enum: ["running", "paused", "waiting", "completed", "failed", "cancelled"], default: "running" },
  currentNodeId: { type: String, required: true },
  context: { type: Schema.Types.Mixed, default: {} },
  variables: { type: Schema.Types.Mixed, default: {} },
  entryType: { type: String, enum: ["manual", "trigger", "scheduled", "api"], required: true },
  triggerId: { type: String },
  nodeHistory: [{
    nodeId: { type: String, required: true },
    nodeType: { type: String, required: true },
    enteredAt: { type: Date, required: true },
    exitedAt: { type: Date },
    status: { type: String, enum: ["entered", "completed", "failed", "skipped"], required: true },
    result: { type: Schema.Types.Mixed },
    error: { type: String }
  }],
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  waitingUntil: { type: Date },
  waitingFor: { type: String },
  error: { type: String },
  metadata: { type: Schema.Types.Mixed }
}, { timestamps: true });
FlowInstanceSchema.index({ flowId: 1, status: 1 });
FlowInstanceSchema.index({ userId: 1, status: 1 });
FlowInstanceSchema.index({ userId: 1, createdAt: -1 });
FlowInstanceSchema.index({ contactId: 1, flowId: 1 });
const FlowInstance = mongoose.models.FlowInstance || mongoose.model("FlowInstance", FlowInstanceSchema);
export {
  FlowDefinition,
  FlowInstance
};
