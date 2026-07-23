import mongoose from 'mongoose';

import { addEmailMarketingWorkspaceOwnership } from './workspaceOwnership.js';

const dnsRecordSchema = new mongoose.Schema(
  {
    purpose: {
      type: String,
      enum: ['dkim', 'spf', 'dmarc', 'tracking', 'return_path_mx', 'return_path_spf'],
      required: true,
    },
    type: { type: String, enum: ['TXT', 'CNAME', 'MX'], required: true },
    name: { type: String, trim: true, required: true, maxlength: 500 },
    value: { type: String, trim: true, required: true, maxlength: 2000 },
    priority: { type: Number, default: null },
    status: {
      type: String,
      enum: ['pending', 'verified', 'missing', 'incorrect', 'failed'],
      default: 'pending',
    },
    actualValue: { type: String, trim: true, default: '', maxlength: 2000 },
    lastCheckedAt: { type: Date, default: null },
    lastError: { type: String, trim: true, default: '', maxlength: 1000 },
  },
  { _id: true },
);

const emailMarketingDomainSchema = new mongoose.Schema(
  {
    domain: { type: String, required: true, trim: true, lowercase: true, maxlength: 253 },
    status: {
      type: String,
      enum: ['pending', 'verified', 'failed'],
      default: 'pending',
      index: true,
    },
    provider: { type: String, enum: ['aws_ses'], default: 'aws_ses' },
    providerIdentity: { type: String, trim: true, default: '' },
    dkimTokens: { type: [String], default: [] },
    trackingSubdomain: { type: String, trim: true, default: '' },
    mailFromDomain: { type: String, trim: true, default: '' },
    dnsRecords: { type: [dnsRecordSchema], default: [] },
    lastCheckedAt: { type: Date, default: null },
    providerStatus: { type: String, trim: true, default: '' },
    dkimStatus: { type: String, trim: true, default: '' },
    mailFromStatus: { type: String, trim: true, default: '' },
    verifiedAt: { type: Date, default: null },
    health: {
      reputation: { type: Number, default: 0, min: 0, max: 100 },
      deliveryRate: { type: Number, default: 0, min: 0, max: 100 },
      bounceRate: { type: Number, default: 0, min: 0, max: 100 },
      complaintRate: { type: Number, default: 0, min: 0, max: 100 },
    },
    dedicatedIp: {
      status: {
        type: String,
        enum: ['not_requested', 'requested', 'approved'],
        default: 'not_requested',
      },
      notes: { type: String, trim: true, default: '', maxlength: 2000 },
      ipAddress: { type: String, trim: true, default: '' },
      requestedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
    collection: 'email_marketing_domains',
  },
);

addEmailMarketingWorkspaceOwnership(emailMarketingDomainSchema);
emailMarketingDomainSchema.index(
  { workspaceId: 1, domain: 1 },
  { unique: true },
);
emailMarketingDomainSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 });

const EmailMarketingDomain =
  mongoose.models.EmailMarketingDomain ||
  mongoose.model('EmailMarketingDomain', emailMarketingDomainSchema);

export default EmailMarketingDomain;
