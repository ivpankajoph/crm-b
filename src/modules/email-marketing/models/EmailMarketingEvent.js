import mongoose from 'mongoose';

import { addEmailMarketingWorkspaceOwnership } from './workspaceOwnership.js';

export const emailEventTypes = [
  'send',
  'delivery',
  'open',
  'click',
  'bounce',
  'complaint',
  'reject',
  'unsubscribe',
  'failed',
];

const emailMarketingEventSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingCampaign',
      required: true,
      index: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingRecipient',
      required: true,
      index: true,
    },
    subscriberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingSubscriber',
      required: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    messageId: { type: String, trim: true, required: true, index: true },
    providerEventId: { type: String, trim: true, required: true },
    eventType: { type: String, enum: emailEventTypes, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    clickedLink: { type: String, trim: true, default: '', maxlength: 4000 },
    ipAddress: { type: String, trim: true, default: '', maxlength: 100 },
    userAgent: { type: String, trim: true, default: '', maxlength: 1000 },
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    collection: 'email_marketing_events',
  },
);

addEmailMarketingWorkspaceOwnership(emailMarketingEventSchema);
emailMarketingEventSchema.index(
  { workspaceId: 1, providerEventId: 1 },
  { unique: true },
);
emailMarketingEventSchema.index({
  workspaceId: 1,
  campaignId: 1,
  eventType: 1,
  timestamp: -1,
});

const EmailMarketingEvent =
  mongoose.models.EmailMarketingEvent ||
  mongoose.model('EmailMarketingEvent', emailMarketingEventSchema);

export default EmailMarketingEvent;
