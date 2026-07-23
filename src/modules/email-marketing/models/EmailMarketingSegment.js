import { randomUUID } from 'node:crypto';

import mongoose from 'mongoose';

import { addEmailMarketingWorkspaceOwnership } from './workspaceOwnership.js';

export const segmentFields = ['status', 'tag', 'source', 'email', 'createdAt'];
export const segmentOperators = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'within_days',
];

const segmentConditionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: randomUUID,
    },
    field: {
      type: String,
      enum: segmentFields,
      required: true,
    },
    operator: {
      type: String,
      enum: segmentOperators,
      required: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false },
);

const emailMarketingSegmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    logic: {
      type: String,
      enum: ['and', 'or'],
      default: 'and',
    },
    conditions: {
      type: [segmentConditionSchema],
      default: [],
      validate: {
        validator: (conditions) => conditions.length > 0 && conditions.length <= 25,
        message: 'Segments require between 1 and 25 conditions',
      },
    },
  },
  {
    timestamps: true,
    collection: 'email_marketing_segments',
  },
);

addEmailMarketingWorkspaceOwnership(emailMarketingSegmentSchema);
emailMarketingSegmentSchema.index(
  { workspaceId: 1, name: 1 },
  { unique: true },
);

const EmailMarketingSegment =
  mongoose.models.EmailMarketingSegment ||
  mongoose.model('EmailMarketingSegment', emailMarketingSegmentSchema);

export default EmailMarketingSegment;
