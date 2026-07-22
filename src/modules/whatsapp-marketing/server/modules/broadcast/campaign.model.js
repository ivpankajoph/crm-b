import mongoose, { Schema } from "mongoose";
const CampaignContactSchema = new Schema({
  contactId: { type: String, required: true },
  phone: { type: String, required: true },
  name: { type: String, default: "" },
  status: {
    type: String,
    enum: ["pending", "sent", "delivered", "read", "failed"],
    default: "pending"
  },
  messageId: { type: String },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  failedAt: { type: Date },
  replied: { type: Boolean, default: false },
  repliedAt: { type: Date },
  replyText: { type: String },
  interestStatus: {
    type: String,
    enum: ["interested", "not_interested", "neutral", "pending"],
    default: "pending"
  },
  error: { type: String }
}, { _id: false });
const CampaignSchema = new Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  messageType: {
    type: String,
    enum: ["template", "custom", "ai_agent"],
    required: true
  },
  templateName: { type: String },
  customMessage: { type: String },
  agentId: { type: String },
  contacts: [CampaignContactSchema],
  status: {
    type: String,
    enum: ["draft", "scheduled", "sending", "completed", "cancelled"],
    default: "draft",
    index: true
  },
  scheduledAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  metrics: {
    totalContacts: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    replied: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    interested: { type: Number, default: 0 },
    notInterested: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  collection: "broadcast_campaigns"
});
CampaignSchema.index({ userId: 1, status: 1 });
CampaignSchema.index({ userId: 1, createdAt: -1 });
CampaignSchema.index({ "contacts.phone": 1 });
CampaignSchema.index({ "contacts.messageId": 1 });
const Campaign = mongoose.models.Campaign || mongoose.model("Campaign", CampaignSchema);
export {
  Campaign
};
