import mongoose from 'mongoose';

const emailMarketingWorkspaceSchema = new mongoose.Schema(
  {
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true,
    },
    settings: {
      timezone: {
        type: String,
        trim: true,
        default: 'Asia/Kolkata',
        maxlength: 100,
      },
      defaultFromName: {
        type: String,
        trim: true,
        default: '',
        maxlength: 120,
      },
      defaultFromEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: '',
        maxlength: 254,
      },
      defaultReplyTo: {
        type: String,
        trim: true,
        lowercase: true,
        default: '',
        maxlength: 254,
      },
      trackingEnabled: {
        type: Boolean,
        default: true,
      },
      unsubscribeFooterEnabled: {
        type: Boolean,
        default: true,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'email_marketing_workspaces',
  },
);

emailMarketingWorkspaceSchema.index({ ownerUserId: 1 }, { unique: true });

const EmailMarketingWorkspace =
  mongoose.models.EmailMarketingWorkspace ||
  mongoose.model('EmailMarketingWorkspace', emailMarketingWorkspaceSchema);

export default EmailMarketingWorkspace;
