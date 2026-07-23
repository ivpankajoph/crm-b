import mongoose from 'mongoose';

import { addEmailMarketingWorkspaceOwnership } from './workspaceOwnership.js';

const emailMarketingMediaAssetSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      trim: true,
      required: true,
      maxlength: 255,
    },
    fileName: {
      type: String,
      trim: true,
      required: true,
      maxlength: 255,
    },
    relativePath: {
      type: String,
      trim: true,
      required: true,
      maxlength: 1000,
    },
    url: {
      type: String,
      trim: true,
      required: true,
      maxlength: 2048,
    },
    mimeType: {
      type: String,
      enum: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: 1,
      max: 5242880,
    },
  },
  {
    timestamps: true,
    collection: 'email_marketing_media_assets',
  },
);

addEmailMarketingWorkspaceOwnership(emailMarketingMediaAssetSchema);
emailMarketingMediaAssetSchema.index({
  workspaceId: 1,
  createdAt: -1,
});

const EmailMarketingMediaAsset =
  mongoose.models.EmailMarketingMediaAsset ||
  mongoose.model(
    'EmailMarketingMediaAsset',
    emailMarketingMediaAssetSchema,
  );

export default EmailMarketingMediaAsset;
