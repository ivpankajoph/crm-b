import mongoose from 'mongoose';

import { addEmailMarketingWorkspaceOwnership } from './workspaceOwnership.js';

const stepResultSchema = new mongoose.Schema(
  {
    stepIndex: { type: Number, required: true, min: 0 },
    stepType: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['completed', 'skipped', 'failed'],
      required: true,
    },
    message: { type: String, trim: true, default: '', maxlength: 2000 },
    messageId: { type: String, trim: true, default: '' },
    completedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const emailMarketingAutomationExecutionSchema = new mongoose.Schema(
  {
    automationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingAutomation',
      required: true,
      index: true,
    },
    subscriberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingSubscriber',
      default: null,
      index: true,
    },
    subscriberEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    trigger: { type: String, required: true, trim: true, maxlength: 100 },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'exited', 'cancelled'],
      default: 'pending',
      index: true,
    },
    currentStep: { type: Number, default: 0, min: 0 },
    scheduledFor: { type: Date, default: null, index: true },
    context: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    triggerKey: { type: String, trim: true, default: '', maxlength: 200 },
    stepResults: { type: [stepResultSchema], default: [] },
    emailsSent: { type: Number, default: 0, min: 0 },
    lastError: { type: String, trim: true, default: '', maxlength: 2000 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'email_marketing_automation_executions',
  },
);

addEmailMarketingWorkspaceOwnership(emailMarketingAutomationExecutionSchema);
emailMarketingAutomationExecutionSchema.index({
  workspaceId: 1,
  automationId: 1,
  createdAt: -1,
});
emailMarketingAutomationExecutionSchema.index(
  { workspaceId: 1, automationId: 1, triggerKey: 1 },
  {
    unique: true,
    partialFilterExpression: { triggerKey: { $type: 'string', $gt: '' } },
  },
);
emailMarketingAutomationExecutionSchema.index({
  workspaceId: 1,
  subscriberEmail: 1,
  status: 1,
});

const EmailMarketingAutomationExecution =
  mongoose.models.EmailMarketingAutomationExecution ||
  mongoose.model(
    'EmailMarketingAutomationExecution',
    emailMarketingAutomationExecutionSchema,
  );

export default EmailMarketingAutomationExecution;
