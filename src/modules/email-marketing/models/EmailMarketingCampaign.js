import mongoose from 'mongoose';

import { addEmailMarketingWorkspaceOwnership } from './workspaceOwnership.js';

export const campaignTypes = [
  'promotional',
  'broadcast',
  'newsletter',
  'product_launch',
  'win_back',
  'drip_campaign',
];
export const campaignGoals = ['clicks', 'orders', 'revenue', 'reactivation'];
export const campaignStatuses = [
  'draft',
  'active',
  'scheduled',
  'sending',
  'sent',
  'paused',
  'failed',
  'archived',
];

const metricSchema = new mongoose.Schema(
  {
    sent: { type: Number, default: 0, min: 0 },
    delivered: { type: Number, default: 0, min: 0 },
    opens: { type: Number, default: 0, min: 0 },
    uniqueOpens: { type: Number, default: 0, min: 0 },
    clicks: { type: Number, default: 0, min: 0 },
    uniqueClicks: { type: Number, default: 0, min: 0 },
    bounces: { type: Number, default: 0, min: 0 },
    complaints: { type: Number, default: 0, min: 0 },
    unsubscribes: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const dripStepSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, required: true, maxlength: 120 },
    delayValue: { type: Number, default: 0, min: 0 },
    delayUnit: {
      type: String,
      enum: ['minutes', 'hours', 'days', 'weeks'],
      default: 'days',
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingTemplate',
      required: true,
    },
    subject: { type: String, trim: true, required: true, maxlength: 255 },
  },
  { _id: true },
);

const emailMarketingCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, enum: campaignTypes, required: true },
    goal: { type: String, enum: campaignGoals, default: 'clicks' },
    subject: { type: String, trim: true, default: '', maxlength: 255 },
    previewText: { type: String, trim: true, default: '', maxlength: 500 },
    fromName: { type: String, trim: true, required: true, maxlength: 120 },
    fromEmail: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      maxlength: 254,
    },
    replyTo: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      maxlength: 254,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingTemplate',
      default: null,
    },
    audienceMode: {
      type: String,
      enum: ['all', 'segment', 'selected'],
      default: 'all',
    },
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingSegment',
      default: null,
    },
    subscriberIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EmailMarketingSubscriber' }],
      default: [],
    },
    status: {
      type: String,
      enum: campaignStatuses,
      default: 'draft',
      index: true,
    },
    scheduledAt: { type: Date, default: null, index: true },
    timezone: { type: String, trim: true, default: 'Asia/Kolkata', maxlength: 100 },
    isRecurring: { type: Boolean, default: false },
    recurrenceInterval: { type: Number, default: 1, min: 1, max: 365 },
    recurrenceUnit: {
      type: String,
      enum: ['day', 'week', 'month'],
      default: 'week',
    },
    recurrenceEndAt: { type: Date, default: null },
    recurrenceRunCount: { type: Number, default: 0, min: 0 },
    dripTargetAudience: {
      type: String,
      enum: ['all', 'new_only'],
      default: 'all',
    },
    dripSteps: {
      type: [dripStepSchema],
      default: [],
      validate: {
        validator: (steps) => steps.length <= 50,
        message: 'A drip campaign can contain at most 50 steps',
      },
    },
    currentDripStep: { type: Number, default: 0, min: 0 },
    totalRecipients: { type: Number, default: 0, min: 0 },
    metrics: { type: metricSchema, default: () => ({}) },
    lastSentAt: { type: Date, default: null },
    lastError: { type: String, trim: true, default: '', maxlength: 2000 },
    processing: { type: Boolean, default: false },
    processingStartedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'email_marketing_campaigns',
  },
);

addEmailMarketingWorkspaceOwnership(emailMarketingCampaignSchema);
emailMarketingCampaignSchema.index({
  workspaceId: 1,
  status: 1,
  scheduledAt: 1,
});
emailMarketingCampaignSchema.index({ workspaceId: 1, updatedAt: -1 });

const EmailMarketingCampaign =
  mongoose.models.EmailMarketingCampaign ||
  mongoose.model('EmailMarketingCampaign', emailMarketingCampaignSchema);

export default EmailMarketingCampaign;
