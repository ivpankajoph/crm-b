import { z } from 'zod';

import {
  automationStatuses,
  automationStepTypes,
  automationTriggers,
} from '../models/EmailMarketingAutomation.js';
import { EMAIL_MARKETING_PERMISSION_VALUES } from '../constants/permissions.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid resource id');
const optionalObjectId = z.union([z.literal(''), objectId]).optional();
const optionalEmail = z.union([z.literal(''), z.string().trim().email().max(254)]);
const noNewlines = (min, max) =>
  z.string().trim().min(min).max(max).regex(/^[^\r\n]*$/, 'Line breaks are not allowed');

const envelope = (body, params = z.object({}).passthrough(), query = z.object({}).passthrough()) =>
  z.object({ body, params, query });

const automationStep = z
  .object({
    id: z.string().trim().min(1).max(100).optional(),
    type: z.enum(automationStepTypes),
    title: z.string().trim().min(1).max(160),
    delayValue: z.coerce.number().min(0).max(3650).default(1),
    delayUnit: z.enum(['minutes', 'hours', 'days']).default('days'),
    templateId: optionalObjectId.default(''),
    subject: noNewlines(0, 255).default(''),
    field: z.string().trim().max(120).default(''),
    operator: z
      .enum(['', 'equals', 'not_equals', 'contains', 'not_contains', 'exists'])
      .default(''),
    value: z.string().trim().max(4000).default(''),
  })
  .strict()
  .superRefine((step, context) => {
    if (step.type === 'send_email' && (!step.templateId || !step.subject)) {
      context.addIssue({
        code: 'custom',
        message: 'Email steps require a template and subject',
      });
    }
    if (step.type === 'condition' && (!step.field || !step.operator)) {
      context.addIssue({
        code: 'custom',
        message: 'Condition steps require a field and operator',
      });
    }
    if (step.type === 'webhook') {
      try {
        const url = new URL(step.value);
        if (url.protocol !== 'https:') throw new Error();
      } catch {
        context.addIssue({
          code: 'custom',
          message: 'Webhook steps require a valid HTTPS URL',
        });
      }
    }
  });

const automationFields = {
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000),
  trigger: z.enum(automationTriggers),
  status: z.enum(automationStatuses),
  segmentId: optionalObjectId,
  replyTo: optionalEmail,
  notes: z.string().trim().max(5000),
  steps: z.array(automationStep).min(1).max(50),
};

export const createAutomationSchema = envelope(
  z
    .object({
      name: automationFields.name,
      description: automationFields.description.default(''),
      trigger: automationFields.trigger,
      status: automationFields.status.default('draft'),
      segmentId: automationFields.segmentId.default(''),
      replyTo: automationFields.replyTo.default(''),
      notes: automationFields.notes.default(''),
      steps: automationFields.steps,
    })
    .strict(),
);

export const updateAutomationSchema = envelope(
  z.object(automationFields).partial().strict().refine(
    (body) => Object.keys(body).length > 0,
    'At least one field is required',
  ),
  z.object({ id: objectId }),
);

export const automationIdSchema = envelope(
  z.unknown().optional(),
  z.object({ id: objectId }),
);

export const listAutomationsSchema = envelope(
  z.unknown().optional(),
  z.object({}).passthrough(),
  z
    .object({
      status: z.enum(['all', ...automationStatuses]).default('all'),
      trigger: z.enum(['all', ...automationTriggers]).default('all'),
      search: z.string().trim().max(200).optional(),
    })
    .passthrough(),
);

export const testAutomationSchema = envelope(
  z.object({ email: z.string().trim().email().max(254) }).strict(),
  z.object({ id: objectId }),
);

export const triggerAutomationSchema = envelope(
  z
    .object({
      trigger: z.enum(automationTriggers),
      subscriberId: optionalObjectId.default(''),
      email: optionalEmail.default(''),
      idempotencyKey: z.string().trim().min(8).max(200).optional(),
      context: z.record(z.string(), z.unknown()).default({}),
    })
    .strict()
    .refine((body) => body.subscriberId || body.email, 'Subscriber id or email is required'),
);

const dateRangeQuery = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    days: z.coerce.number().int().min(1).max(366).default(30),
  })
  .passthrough();

export const analyticsQuerySchema = envelope(
  z.unknown().optional(),
  z.object({}).passthrough(),
  dateRangeQuery,
);

export const reportQuerySchema = envelope(
  z.unknown().optional(),
  z.object({}).passthrough(),
  dateRangeQuery.extend({
    target: z.enum(['campaigns', 'audience', 'deliverability', 'automations']).default('campaigns'),
    format: z.enum(['json', 'csv']).default('json'),
  }),
);

export const billingProfileSchema = envelope(
  z
    .object({
      billingName: z.string().trim().max(160),
      billingEmail: optionalEmail,
      companyName: z.string().trim().max(200),
      gstin: z.string().trim().max(20),
      address: z.string().trim().max(2000),
    })
    .partial()
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'At least one field is required'),
);

export const purchaseCreditsSchema = envelope(
  z
    .object({
      credits: z.coerce.number().int().positive().max(10_000_000),
      amount: z.coerce.number().min(0).max(100_000_000),
      idempotencyKey: z.string().trim().min(8).max(200),
    })
    .strict(),
);

const teamFields = {
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  status: z.enum(['active', 'inactive']),
  permissions: z.array(z.enum(EMAIL_MARKETING_PERMISSION_VALUES)).max(
    EMAIL_MARKETING_PERMISSION_VALUES.length,
  ),
};

export const createTeamUserSchema = envelope(
  z.object(teamFields).strict(),
);

export const updateTeamUserSchema = envelope(
  z
    .object({
      status: teamFields.status.optional(),
      permissions: teamFields.permissions.optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'At least one field is required'),
  z.object({ id: objectId }),
);

export const teamUserIdSchema = automationIdSchema;
