import mongoose from 'mongoose';

const emailMarketingAuditLogSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingWorkspace',
      required: true,
      immutable: true,
      index: true,
    },
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    resourceType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'email_marketing_audit_logs',
  },
);

emailMarketingAuditLogSchema.index({ workspaceId: 1, createdAt: -1 });
emailMarketingAuditLogSchema.index({
  workspaceId: 1,
  resourceType: 1,
  resourceId: 1,
});

const EmailMarketingAuditLog =
  mongoose.models.EmailMarketingAuditLog ||
  mongoose.model('EmailMarketingAuditLog', emailMarketingAuditLogSchema);

export default EmailMarketingAuditLog;
