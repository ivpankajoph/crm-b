import mongoose from 'mongoose';

import { addEmailMarketingWorkspaceOwnership } from './workspaceOwnership.js';

const emailMarketingBillingAccountSchema = new mongoose.Schema(
  {
    creditBalance: { type: Number, default: 0, min: 0 },
    creditsUsed: { type: Number, default: 0, min: 0 },
    billingName: { type: String, trim: true, default: '', maxlength: 160 },
    billingEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      maxlength: 254,
    },
    companyName: { type: String, trim: true, default: '', maxlength: 200 },
    gstin: { type: String, trim: true, uppercase: true, default: '', maxlength: 20 },
    address: { type: String, trim: true, default: '', maxlength: 2000 },
    currency: { type: String, trim: true, uppercase: true, default: 'INR' },
    frozen: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'email_marketing_billing_accounts',
  },
);

addEmailMarketingWorkspaceOwnership(emailMarketingBillingAccountSchema);
emailMarketingBillingAccountSchema.index({ workspaceId: 1 }, { unique: true });

const EmailMarketingBillingAccount =
  mongoose.models.EmailMarketingBillingAccount ||
  mongoose.model(
    'EmailMarketingBillingAccount',
    emailMarketingBillingAccountSchema,
  );

export default EmailMarketingBillingAccount;
