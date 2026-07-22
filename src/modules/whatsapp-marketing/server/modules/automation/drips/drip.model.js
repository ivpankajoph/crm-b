import mongoose, { Schema } from "mongoose";
const DripStepSchema = new Schema({
  id: { type: String, required: true },
  order: { type: Number, default: 0 },
  name: { type: String, required: true },
  dayOffset: { type: Number, default: 0 },
  delayDays: { type: Number, default: 0 },
  delayHours: { type: Number, default: 0 },
  delayMinutes: { type: Number, default: 0 },
  timeOfDay: { type: String },
  messageType: { type: String, enum: ["template", "text", "media", "interactive", "ai_agent"], required: true },
  templateId: { type: String },
  templateName: { type: String },
  textContent: { type: String },
  mediaUrl: { type: String },
  mediaType: { type: String, enum: ["image", "video", "document", "audio"] },
  buttons: [{
    type: { type: String, enum: ["quick_reply", "url", "call"] },
    text: { type: String },
    value: { type: String }
  }],
  conditions: [{
    field: { type: String },
    operator: { type: String },
    value: { type: Schema.Types.Mixed }
  }],
  skipIfReplied: { type: Boolean, default: false },
  skipIfConverted: { type: Boolean, default: false },
  aiAgentId: { type: String },
  aiAgentName: { type: String },
  status: { type: String, enum: ["active", "paused"], default: "active" }
}, { _id: false });
const DripCampaignSchema = new Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ["draft", "active", "paused", "completed", "archived"], default: "draft" },
  steps: { type: [DripStepSchema], default: [] },
  targetType: { type: String, enum: ["segment", "tag", "manual", "trigger", "imported", "interest", "auto_trigger"], required: true },
  targetSegmentIds: { type: [String] },
  targetTags: { type: [String] },
  targetTriggerId: { type: String },
  importedContacts: { type: [String] },
  excludeSegmentIds: { type: [String] },
  excludeTags: { type: [String] },
  deliveryMode: { type: String, enum: ["template", "ai_agent", "mixed"], default: "template" },
  defaultTemplateId: { type: String },
  defaultTemplateName: { type: String },
  defaultAiAgentId: { type: String },
  defaultAiAgentName: { type: String },
  autoTrigger: {
    enabled: { type: Boolean, default: false },
    sources: { type: [String], enum: ["interest_interested", "interest_not_interested", "interest_neutral", "facebook_new_lead", "new_message", "none"], default: [] },
    sendImmediately: { type: Boolean, default: true },
    initialMessage: { type: String }
  },
  interestTargeting: {
    targetInterestLevels: { type: [String], enum: ["interested", "not_interested", "neutral", "pending"], default: [] },
    autoEnroll: { type: Boolean, default: false },
    enrollOnClassification: { type: Boolean, default: true }
  },
  timezone: { type: String, default: "UTC" },
  startDate: { type: Date },
  endDate: { type: Date },
  schedule: {
    daysOfWeek: { type: [Number], default: [1, 2, 3, 4, 5] },
    startTime: { type: String, default: "09:00" },
    endTime: { type: String, default: "18:00" }
  },
  settings: {
    allowReEntry: { type: Boolean, default: false },
    reEntryDelayDays: { type: Number, default: 30 },
    stopOnReply: { type: Boolean, default: false },
    stopOnConversion: { type: Boolean, default: true },
    maxContactsPerDay: { type: Number, default: 1e3 },
    sendingSpeed: { type: String, enum: ["slow", "normal", "fast"], default: "normal" }
  },
  metrics: {
    totalEnrolled: { type: Number, default: 0 },
    activeContacts: { type: Number, default: 0 },
    completedContacts: { type: Number, default: 0 },
    exitedContacts: { type: Number, default: 0 },
    totalSent: { type: Number, default: 0 },
    totalDelivered: { type: Number, default: 0 },
    totalRead: { type: Number, default: 0 },
    totalReplied: { type: Number, default: 0 },
    totalConverted: { type: Number, default: 0 },
    totalFailed: { type: Number, default: 0 }
  },
  tags: { type: [String], default: [] }
}, { timestamps: true });
DripCampaignSchema.index({ userId: 1, status: 1 });
DripCampaignSchema.index({ userId: 1, name: 1 });
const DripCampaign = mongoose.models.DripCampaign || mongoose.model("DripCampaign", DripCampaignSchema);
const DripRunSchema = new Schema({
  campaignId: { type: Schema.Types.ObjectId, ref: "DripCampaign", required: true, index: true },
  userId: { type: String, required: true, index: true },
  contactId: { type: String, required: true, index: true },
  contactPhone: { type: String, required: true },
  status: { type: String, enum: ["active", "paused", "completed", "exited", "failed"], default: "active" },
  currentStepIndex: { type: Number, default: 0 },
  enrolledAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  exitedAt: { type: Date },
  exitReason: { type: String, enum: ["completed", "replied", "converted", "unsubscribed", "manual", "error", "campaign_ended"] },
  stepHistory: [{
    stepId: { type: String, required: true },
    stepOrder: { type: Number, required: true },
    status: { type: String, enum: ["sent", "delivered", "read", "replied", "failed", "skipped"], required: true },
    messageId: { type: String },
    scheduledAt: { type: Date, required: true },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    repliedAt: { type: Date },
    error: { type: String }
  }],
  nextStepScheduledAt: { type: Date, index: true },
  variables: { type: Schema.Types.Mixed, default: {} },
  metadata: { type: Schema.Types.Mixed }
}, { timestamps: true });
DripRunSchema.index({ campaignId: 1, status: 1 });
DripRunSchema.index({ userId: 1, status: 1 });
DripRunSchema.index({ campaignId: 1, contactId: 1 }, { unique: true });
DripRunSchema.index({ nextStepScheduledAt: 1, status: 1 });
const DripRun = mongoose.models.DripRun || mongoose.model("DripRun", DripRunSchema);
export {
  DripCampaign,
  DripRun
};
