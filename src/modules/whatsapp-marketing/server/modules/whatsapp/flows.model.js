import mongoose, { Schema } from "mongoose";
const FlowEntryPointSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ["CTA", "BUTTON", "LIST"], default: "CTA" }
}, { _id: false });
const WhatsAppFlowSchema = new Schema({
  userId: { type: String, required: true, index: true },
  flowId: { type: String, required: true },
  name: { type: String, required: true },
  status: {
    type: String,
    enum: ["DRAFT", "PUBLISHED", "DEPRECATED", "BLOCKED", "THROTTLED"],
    default: "DRAFT"
  },
  categories: { type: [String], default: [] },
  validationErrors: { type: [String], default: [] },
  draftValidationErrors: { type: [String], default: [] },
  jsonVersion: { type: String },
  dataApiVersion: { type: String },
  dataChannelUri: { type: String },
  endpointUri: { type: String },
  previewUrl: { type: String },
  previewExpiresAt: { type: Date },
  healthStatus: { type: Schema.Types.Mixed },
  whatsappBusinessAccount: { type: Schema.Types.Mixed },
  application: { type: Schema.Types.Mixed },
  lastMetaSnapshot: { type: Schema.Types.Mixed },
  entryPoints: { type: [FlowEntryPointSchema], default: [] },
  linkedTemplateIds: { type: [String], default: [] },
  linkedAgentIds: { type: [String], default: [] },
  flowData: { type: Schema.Types.Mixed },
  flowJson: { type: Schema.Types.Mixed },
  lastSyncedAt: { type: Date, default: Date.now },
  metaUpdatedAt: { type: Date }
}, {
  timestamps: true
});
WhatsAppFlowSchema.index({ userId: 1, flowId: 1 }, { unique: true });
const WhatsAppFlow = mongoose.models.WhatsAppFlow || mongoose.model("WhatsAppFlow", WhatsAppFlowSchema);
const FlowSyncCheckpointSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  wabaId: { type: String, required: true },
  lastSyncedAt: { type: Date, default: Date.now },
  nextCursor: { type: String },
  syncStatus: { type: String, enum: ["idle", "syncing", "error"], default: "idle" },
  lastError: { type: String }
}, {
  timestamps: true
});
const FlowSyncCheckpoint = mongoose.models.FlowSyncCheckpoint || mongoose.model("FlowSyncCheckpoint", FlowSyncCheckpointSchema);
export {
  FlowSyncCheckpoint,
  WhatsAppFlow
};
