import mongoose, { Schema } from "mongoose";
const SegmentRuleSchema = new Schema({
  field: { type: String, required: true },
  operator: { type: String, enum: ["equals", "not_equals", "contains", "not_contains", "greater_than", "less_than", "in", "not_in", "exists", "not_exists", "between", "before", "after", "within_days", "regex"], required: true },
  value: { type: Schema.Types.Mixed },
  dataType: { type: String, enum: ["string", "number", "boolean", "date", "array"] }
}, { _id: false });
const SegmentRuleGroupSchema = new Schema({
  logic: { type: String, enum: ["AND", "OR"], required: true },
  rules: { type: [Schema.Types.Mixed], default: [] }
}, { _id: false });
const SegmentSchema = new Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  type: { type: String, enum: ["dynamic", "static"], default: "dynamic" },
  status: { type: String, enum: ["active", "inactive", "computing"], default: "active" },
  ruleGroup: { type: SegmentRuleGroupSchema, default: { logic: "AND", rules: [] } },
  refreshStrategy: { type: String, enum: ["realtime", "hourly", "daily", "manual"], default: "hourly" },
  lastRefreshedAt: { type: Date },
  memberCount: { type: Number, default: 0 },
  estimatedCount: { type: Number },
  usedInTriggers: { type: Number, default: 0 },
  usedInFlows: { type: Number, default: 0 },
  usedInCampaigns: { type: Number, default: 0 },
  tags: { type: [String], default: [] },
  color: { type: String },
  icon: { type: String }
}, { timestamps: true });
SegmentSchema.index({ userId: 1, status: 1 });
SegmentSchema.index({ userId: 1, name: 1 });
SegmentSchema.index({ userId: 1, type: 1 });
const Segment = mongoose.models.Segment || mongoose.model("Segment", SegmentSchema);
const SegmentMemberSchema = new Schema({
  segmentId: { type: Schema.Types.ObjectId, ref: "Segment", required: true, index: true },
  userId: { type: String, required: true, index: true },
  contactId: { type: String, required: true, index: true },
  addedAt: { type: Date, default: Date.now },
  source: { type: String, enum: ["rule_match", "manual", "import", "trigger", "api"], default: "rule_match" },
  metadata: { type: Schema.Types.Mixed }
}, { timestamps: true });
SegmentMemberSchema.index({ segmentId: 1, contactId: 1 }, { unique: true });
SegmentMemberSchema.index({ userId: 1, contactId: 1 });
SegmentMemberSchema.index({ segmentId: 1, addedAt: -1 });
const SegmentMember = mongoose.models.SegmentMember || mongoose.model("SegmentMember", SegmentMemberSchema);
export {
  Segment,
  SegmentMember
};
