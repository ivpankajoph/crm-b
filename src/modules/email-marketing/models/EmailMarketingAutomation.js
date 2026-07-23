import mongoose from 'mongoose';

import { addEmailMarketingWorkspaceOwnership } from './workspaceOwnership.js';

export const automationTriggers = [
  'welcome_signup',
  'welcome_series',
  'order_confirmation',
  'payment_success',
  'shipping_update',
  'delivery_confirmation',
  'abandoned_cart',
  'browse_abandonment',
  'order_followup',
  'review_request',
  'win_back',
  'price_drop',
  'back_in_stock',
  'inactive_subscriber',
  'reminder_email',
  'discount_offer',
];

export const automationStatuses = ['draft', 'active', 'inactive', 'archived'];
export const automationStepTypes = [
  'delay',
  'condition',
  'send_email',
  'add_tag',
  'remove_tag',
  'webhook',
  'exit',
];

const automationStepSchema = new mongoose.Schema(
  {
    type: { type: String, enum: automationStepTypes, required: true },
    title: { type: String, trim: true, required: true, maxlength: 160 },
    delayValue: { type: Number, default: 1, min: 0, max: 3650 },
    delayUnit: {
      type: String,
      enum: ['minutes', 'hours', 'days'],
      default: 'days',
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingTemplate',
      default: null,
    },
    subject: { type: String, trim: true, default: '', maxlength: 255 },
    field: { type: String, trim: true, default: '', maxlength: 120 },
    operator: {
      type: String,
      enum: ['', 'equals', 'not_equals', 'contains', 'not_contains', 'exists'],
      default: '',
    },
    value: { type: String, trim: true, default: '', maxlength: 4000 },
  },
  { _id: true },
);

const emailMarketingAutomationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true, maxlength: 160 },
    description: { type: String, trim: true, default: '', maxlength: 2000 },
    trigger: { type: String, enum: automationTriggers, required: true },
    status: {
      type: String,
      enum: automationStatuses,
      default: 'draft',
      index: true,
    },
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingSegment',
      default: null,
    },
    replyTo: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      maxlength: 254,
    },
    notes: { type: String, trim: true, default: '', maxlength: 5000 },
    steps: {
      type: [automationStepSchema],
      validate: {
        validator: (steps) => steps.length > 0 && steps.length <= 50,
        message: 'An automation requires 1 to 50 steps',
      },
    },
    executionCount: { type: Number, default: 0, min: 0 },
    completedCount: { type: Number, default: 0, min: 0 },
    failedCount: { type: Number, default: 0, min: 0 },
    emailsSent: { type: Number, default: 0, min: 0 },
    lastRunAt: { type: Date, default: null },
    activatedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'email_marketing_automations',
  },
);

addEmailMarketingWorkspaceOwnership(emailMarketingAutomationSchema);
emailMarketingAutomationSchema.index({ workspaceId: 1, trigger: 1, status: 1 });
emailMarketingAutomationSchema.index({ workspaceId: 1, updatedAt: -1 });

const EmailMarketingAutomation =
  mongoose.models.EmailMarketingAutomation ||
  mongoose.model('EmailMarketingAutomation', emailMarketingAutomationSchema);

export default EmailMarketingAutomation;
