import mongoose from 'mongoose';

export const addEmailMarketingWorkspaceOwnership = (schema) => {
  schema.add({
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailMarketingWorkspace',
      required: true,
      immutable: true,
      index: true,
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
  });

  schema.index({ workspaceId: 1, createdAt: -1 });
  return schema;
};
