import mongoose from 'mongoose';

const resourceAccessSchema = new mongoose.Schema(
  {
    resourceType: {
      type: String,
      enum: ['email_template', 'whatsapp_template'],
      required: true,
      index: true,
    },
    resourceId: {
      type: String,
      required: true,
      trim: true,
    },
    resourceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    resourceStatus: {
      type: String,
      trim: true,
      default: '',
    },
    visibility: {
      type: String,
      enum: ['restricted', 'company'],
      default: 'restricted',
    },
    roleIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
    }],
    teamIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
    }],
    userIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    actions: {
      type: [{
        type: String,
        enum: ['use', 'edit', 'share'],
      }],
      default: ['use'],
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

resourceAccessSchema.index(
  { ownerUserId: 1, resourceType: 1, resourceId: 1 },
  { unique: true },
);
resourceAccessSchema.index({ userIds: 1, resourceType: 1 });
resourceAccessSchema.index({ teamIds: 1, resourceType: 1 });
resourceAccessSchema.index({ roleIds: 1, resourceType: 1 });

const ResourceAccess = mongoose.models.ResourceAccess
  || mongoose.model('ResourceAccess', resourceAccessSchema);

export default ResourceAccess;
