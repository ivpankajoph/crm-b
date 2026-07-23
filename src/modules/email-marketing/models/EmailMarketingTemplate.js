import { randomUUID } from 'node:crypto';

import mongoose from 'mongoose';

import { addEmailMarketingWorkspaceOwnership } from './workspaceOwnership.js';

export const templateTypes = ['visual', 'simple', 'html'];
export const templateStatuses = ['draft', 'active', 'archived'];
export const emailBlockTypes = [
  'heading',
  'text',
  'button',
  'image',
  'divider',
  'spacer',
];

const emailBlockSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: randomUUID,
    },
    type: {
      type: String,
      enum: emailBlockTypes,
      required: true,
    },
    content: {
      type: String,
      default: '',
      maxlength: 250000,
    },
    href: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2048,
    },
    align: {
      type: String,
      enum: ['left', 'center', 'right'],
      default: 'left',
    },
  },
  { _id: false },
);

const emailMarketingTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    preheader: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    type: {
      type: String,
      enum: templateTypes,
      default: 'visual',
      index: true,
    },
    status: {
      type: String,
      enum: templateStatuses,
      default: 'draft',
      index: true,
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
      maxlength: 80,
    },
    htmlContent: {
      type: String,
      default: '',
      maxlength: 1000000,
    },
    blocks: {
      type: [emailBlockSchema],
      default: [],
      validate: {
        validator: (blocks) => blocks.length <= 200,
        message: 'A template can contain at most 200 blocks',
      },
    },
  },
  {
    timestamps: true,
    collection: 'email_marketing_templates',
  },
);

addEmailMarketingWorkspaceOwnership(emailMarketingTemplateSchema);
emailMarketingTemplateSchema.index(
  { workspaceId: 1, name: 1 },
  { unique: true },
);
emailMarketingTemplateSchema.index({
  workspaceId: 1,
  status: 1,
  updatedAt: -1,
});

const EmailMarketingTemplate =
  mongoose.models.EmailMarketingTemplate ||
  mongoose.model('EmailMarketingTemplate', emailMarketingTemplateSchema);

export default EmailMarketingTemplate;
