import mongoose from 'mongoose';

import { addEmailMarketingWorkspaceOwnership } from './workspaceOwnership.js';

export const recipientStatuses = [
  'queued',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'complained',
  'unsubscribed',
  'failed',
  'rejected',
];

const emailMarketingRecipientSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingCampaign',
      required: true,
      index: true,
    },
    subscriberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingSubscriber',
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    runNumber: { type: Number, default: 1, min: 1 },
    stepIndex: { type: Number, default: -1, min: -1 },
    messageId: { type: String, trim: true, default: '', index: true },
    status: { type: String, enum: recipientStatuses, default: 'queued', index: true },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    openedAt: { type: Date, default: null },
    clickedAt: { type: Date, default: null },
    bouncedAt: { type: Date, default: null },
    complainedAt: { type: Date, default: null },
    unsubscribedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    lastError: { type: String, trim: true, default: '', maxlength: 2000 },
  },
  {
    timestamps: true,
    collection: 'email_marketing_recipients',
  },
);

addEmailMarketingWorkspaceOwnership(emailMarketingRecipientSchema);
emailMarketingRecipientSchema.index(
  { workspaceId: 1, campaignId: 1, subscriberId: 1, runNumber: 1, stepIndex: 1 },
  { unique: true },
);
emailMarketingRecipientSchema.index({ workspaceId: 1, messageId: 1 });
emailMarketingRecipientSchema.index({ workspaceId: 1, email: 1, updatedAt: -1 });

const EmailMarketingRecipient =
  mongoose.models.EmailMarketingRecipient ||
  mongoose.model('EmailMarketingRecipient', emailMarketingRecipientSchema);

export default EmailMarketingRecipient;
