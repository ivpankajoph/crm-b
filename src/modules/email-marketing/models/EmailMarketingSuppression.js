import mongoose from 'mongoose';

import { addEmailMarketingWorkspaceOwnership } from './workspaceOwnership.js';

export const suppressionTypes = [
  'manual',
  'unsubscribe',
  'bounce',
  'complaint',
];

const emailMarketingSuppressionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    type: {
      type: String,
      enum: suppressionTypes,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ['active', 'released'],
      default: 'active',
      index: true,
    },
    source: {
      type: String,
      trim: true,
      default: 'crm',
      maxlength: 80,
    },
    subscriberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingSubscriber',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'email_marketing_suppressions',
  },
);

addEmailMarketingWorkspaceOwnership(emailMarketingSuppressionSchema);
emailMarketingSuppressionSchema.index(
  { workspaceId: 1, email: 1 },
  { unique: true },
);
emailMarketingSuppressionSchema.index({
  workspaceId: 1,
  status: 1,
  type: 1,
  createdAt: -1,
});

const EmailMarketingSuppression =
  mongoose.models.EmailMarketingSuppression ||
  mongoose.model(
    'EmailMarketingSuppression',
    emailMarketingSuppressionSchema,
  );

export default EmailMarketingSuppression;
