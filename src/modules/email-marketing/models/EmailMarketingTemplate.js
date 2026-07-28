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
  'video',
  'dynamic',
  'logo',
  'social',
  'html',
  'divider',
  'product',
  'navigation',
  'spacer',
];

const emailBlockItemSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, required: true, maxlength: 80 },
    url: { type: String, trim: true, default: '', maxlength: 2048 },
  },
  { _id: false },
);

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
    alt: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2048,
    },
    subtitle: {
      type: String,
      default: '',
      maxlength: 5000,
    },
    price: {
      type: String,
      trim: true,
      default: '',
      maxlength: 100,
    },
    buttonText: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    items: {
      type: [emailBlockItemSchema],
      default: undefined,
      validate: {
        validator: (items) => !items || items.length <= 12,
        message: 'A block can contain at most 12 items',
      },
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
      trim: true,
      default: '',
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
