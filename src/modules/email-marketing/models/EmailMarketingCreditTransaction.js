import mongoose from 'mongoose';

import { addEmailMarketingWorkspaceOwnership } from './workspaceOwnership.js';

const emailMarketingCreditTransactionSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingBillingAccount',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'purchase',
        'campaign_send',
        'automation_send',
        'adjustment',
        'refund',
      ],
      required: true,
      index: true,
    },
    credits: { type: Number, required: true },
    amount: { type: Number, default: 0, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: 'INR' },
    balanceBefore: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true, default: '', maxlength: 1000 },
    sourceType: { type: String, trim: true, default: '', maxlength: 80 },
    sourceId: { type: String, trim: true, default: '', maxlength: 100, index: true },
    idempotencyKey: { type: String, trim: true, default: '', maxlength: 200 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  {
    timestamps: true,
    collection: 'email_marketing_credit_transactions',
  },
);

addEmailMarketingWorkspaceOwnership(emailMarketingCreditTransactionSchema);
emailMarketingCreditTransactionSchema.index({
  workspaceId: 1,
  createdAt: -1,
});
emailMarketingCreditTransactionSchema.index(
  { workspaceId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string', $gt: '' } },
  },
);

const EmailMarketingCreditTransaction =
  mongoose.models.EmailMarketingCreditTransaction ||
  mongoose.model(
    'EmailMarketingCreditTransaction',
    emailMarketingCreditTransactionSchema,
  );

export default EmailMarketingCreditTransaction;
