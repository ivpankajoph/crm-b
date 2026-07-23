import mongoose from 'mongoose';

import { addEmailMarketingWorkspaceOwnership } from './workspaceOwnership.js';

const emailMarketingImportSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      trim: true,
      default: '',
      maxlength: 255,
    },
    source: {
      type: String,
      enum: ['csv', 'json'],
      default: 'csv',
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
      index: true,
    },
    totalRows: {
      type: Number,
      default: 0,
      min: 0,
    },
    added: {
      type: Number,
      default: 0,
      min: 0,
    },
    updated: {
      type: Number,
      default: 0,
      min: 0,
    },
    skipped: {
      type: Number,
      default: 0,
      min: 0,
    },
    rowErrors: {
      type: [
        {
          row: Number,
          message: String,
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'email_marketing_imports',
  },
);

addEmailMarketingWorkspaceOwnership(emailMarketingImportSchema);
emailMarketingImportSchema.index({
  workspaceId: 1,
  createdAt: -1,
});

const EmailMarketingImport =
  mongoose.models.EmailMarketingImport ||
  mongoose.model('EmailMarketingImport', emailMarketingImportSchema);

export default EmailMarketingImport;
