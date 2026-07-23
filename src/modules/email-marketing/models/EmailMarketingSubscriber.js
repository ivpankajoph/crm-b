import mongoose from 'mongoose';

import { addEmailMarketingWorkspaceOwnership } from './workspaceOwnership.js';

export const subscriberStatuses = [
  'subscribed',
  'unsubscribed',
  'suppressed',
];

const emailMarketingSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    firstName: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    lastName: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      maxlength: 40,
    },
    status: {
      type: String,
      enum: subscriberStatuses,
      default: 'subscribed',
      index: true,
    },
    source: {
      type: String,
      trim: true,
      default: 'manual',
      maxlength: 120,
    },
    tags: {
      type: [{ type: String, trim: true, maxlength: 80 }],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 5000,
    },
    blocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'email_marketing_subscribers',
  },
);

addEmailMarketingWorkspaceOwnership(emailMarketingSubscriberSchema);
emailMarketingSubscriberSchema.index(
  { workspaceId: 1, email: 1 },
  { unique: true },
);
emailMarketingSubscriberSchema.index({
  workspaceId: 1,
  status: 1,
  updatedAt: -1,
});
emailMarketingSubscriberSchema.index({ workspaceId: 1, tags: 1 });

const EmailMarketingSubscriber =
  mongoose.models.EmailMarketingSubscriber ||
  mongoose.model(
    'EmailMarketingSubscriber',
    emailMarketingSubscriberSchema,
  );

export default EmailMarketingSubscriber;
