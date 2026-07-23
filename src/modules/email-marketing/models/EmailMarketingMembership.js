import mongoose from 'mongoose';

import { EMAIL_MARKETING_PERMISSION_VALUES } from '../constants/permissions.js';

const emailMarketingMembershipSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingWorkspace',
      required: true,
      immutable: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'manager', 'editor', 'analyst', 'viewer'],
      default: 'viewer',
    },
    permissions: {
      type: [{ type: String, enum: EMAIL_MARKETING_PERMISSION_VALUES }],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'email_marketing_memberships',
  },
);

emailMarketingMembershipSchema.index(
  { workspaceId: 1, userId: 1 },
  { unique: true },
);
emailMarketingMembershipSchema.index({ userId: 1, status: 1 });

const EmailMarketingMembership =
  mongoose.models.EmailMarketingMembership ||
  mongoose.model('EmailMarketingMembership', emailMarketingMembershipSchema);

export default EmailMarketingMembership;
