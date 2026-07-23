import { z } from 'zod';

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid resource id');
const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const tags = z.array(z.string().trim().min(1).max(80)).max(50);

const subscriberFields = {
  email,
  firstName: z.string().trim().max(120),
  lastName: z.string().trim().max(120),
  phone: z.string().trim().max(40),
  status: z.enum(['subscribed', 'unsubscribed', 'suppressed']),
  source: z.string().trim().min(1).max(120),
  tags,
  notes: z.string().trim().max(5000),
  blocked: z.boolean(),
  customFields: z.record(z.string(), z.unknown()),
};

const createSubscriberBody = z.object({
  email,
  firstName: subscriberFields.firstName.default(''),
  lastName: subscriberFields.lastName.default(''),
  phone: subscriberFields.phone.default(''),
  status: subscriberFields.status.default('subscribed'),
  source: subscriberFields.source.default('manual'),
  tags: tags.default([]),
  notes: subscriberFields.notes.default(''),
  blocked: subscriberFields.blocked.default(false),
  customFields: subscriberFields.customFields.default({}),
});

const updateSubscriberBody = z.object(subscriberFields).partial();

const requestEnvelope = (body, params = z.object({}).passthrough()) =>
  z.object({
    body,
    params,
    query: z.object({}).passthrough(),
  });

export const listSubscribersSchema = z.object({
  body: z.unknown().optional(),
  params: z.object({}).passthrough(),
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      search: z.string().trim().max(200).optional(),
      status: z.enum(['all', 'subscribed', 'unsubscribed', 'suppressed']).default('all'),
      source: z.string().trim().max(120).optional(),
      tag: z.string().trim().max(80).optional(),
      blocked: z.enum(['true', 'false']).optional(),
      sort: z.enum(['newest', 'oldest', 'email']).default('newest'),
    })
    .passthrough(),
});

export const createSubscriberSchema = requestEnvelope(
  createSubscriberBody.strict(),
);

export const updateSubscriberSchema = requestEnvelope(
  updateSubscriberBody
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'At least one field is required'),
  z.object({ id: objectId }),
);

export const subscriberIdSchema = requestEnvelope(
  z.unknown().optional(),
  z.object({ id: objectId }),
);

export const bulkSubscriberSchema = requestEnvelope(
  z
    .object({
      ids: z.array(objectId).min(1).max(500),
      action: z.enum([
        'unsubscribe',
        'suppress',
        'reactivate',
        'add_tags',
        'delete',
      ]),
      tags: tags.optional(),
      reason: z.string().trim().max(1000).optional(),
    })
    .strict(),
);

export const importSubscribersSchema = requestEnvelope(
  z
    .object({
      rows: z
        .array(
          z
            .object({
              email: z.string(),
              firstName: z.string().optional(),
              lastName: z.string().optional(),
              phone: z.string().optional(),
              status: z.string().optional(),
              source: z.string().optional(),
              tags: z.union([z.array(z.string()), z.string()]).optional(),
              notes: z.string().optional(),
            })
            .passthrough(),
        )
        .min(1)
        .max(10000),
      updateExisting: z.boolean().default(false),
    })
    .strict(),
);

const segmentCondition = z
  .object({
    id: z.string().trim().min(1).max(100).optional(),
    field: z.enum(['status', 'tag', 'source', 'email', 'createdAt']),
    operator: z.enum([
      'equals',
      'not_equals',
      'contains',
      'not_contains',
      'within_days',
    ]),
    value: z.string().trim().min(1).max(500),
  })
  .strict()
  .superRefine((condition, context) => {
    if (condition.operator === 'within_days') {
      const days = Number(condition.value);
      if (
        condition.field !== 'createdAt' ||
        !Number.isInteger(days) ||
        days < 0 ||
        days > 3650
      ) {
        context.addIssue({
          code: 'custom',
          message: 'within_days requires createdAt and a day value from 0 to 3650',
        });
      }
    } else if (condition.field === 'createdAt') {
      context.addIssue({
        code: 'custom',
        message: 'createdAt supports only the within_days operator',
      });
    }
  });

const segmentFields = {
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000),
  logic: z.enum(['and', 'or']),
  conditions: z.array(segmentCondition).min(1).max(25),
};
const segmentBody = z
  .object({
    name: segmentFields.name,
    description: segmentFields.description.default(''),
    logic: segmentFields.logic.default('and'),
    conditions: segmentFields.conditions,
  })
  .strict();

export const createSegmentSchema = requestEnvelope(segmentBody);
export const updateSegmentSchema = requestEnvelope(
  z.object(segmentFields).partial().strict().refine(
    (body) => Object.keys(body).length > 0,
    'At least one field is required',
  ),
  z.object({ id: objectId }),
);
export const previewSegmentSchema = requestEnvelope(
  z.object({
    logic: z.enum(['and', 'or']).default('and'),
    conditions: z.array(segmentCondition).min(1).max(25),
  }),
);

export const listSuppressionsSchema = z.object({
  body: z.unknown().optional(),
  params: z.object({}).passthrough(),
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      search: z.string().trim().max(200).optional(),
      type: z
        .enum(['all', 'manual', 'unsubscribe', 'bounce', 'complaint'])
        .default('all'),
      status: z.enum(['active', 'released']).default('active'),
    })
    .passthrough(),
});

export const createSuppressionSchema = requestEnvelope(
  z
    .object({
      email,
      type: z.enum(['manual', 'unsubscribe', 'bounce', 'complaint']).default('manual'),
      reason: z.string().trim().max(1000).default(''),
    })
    .strict(),
);

export const suppressionIdSchema = subscriberIdSchema;
