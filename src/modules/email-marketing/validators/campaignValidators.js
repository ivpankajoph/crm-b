import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid resource id');
const optionalObjectId = z.union([z.literal(''), objectId]).optional();
const optionalEmail = z.union([z.literal(''), z.string().trim().email().max(254)]);
const headerText = (minimum, maximum) =>
  z
    .string()
    .trim()
    .min(minimum)
    .max(maximum)
    .regex(/^[^\r\n]*$/, 'Email header fields cannot contain line breaks');

const dripStep = z
  .object({
    title: z.string().trim().min(1).max(120),
    delayValue: z.coerce.number().min(0).max(3650),
    delayUnit: z.enum(['minutes', 'hours', 'days', 'weeks']),
    templateId: objectId,
    subject: headerText(1, 255),
  })
  .strict();

const campaignFields = {
  name: z.string().trim().min(2).max(160),
  type: z.enum([
    'promotional',
    'broadcast',
    'newsletter',
    'product_launch',
    'win_back',
    'drip_campaign',
  ]),
  goal: z.enum(['clicks', 'orders', 'revenue', 'reactivation']),
  subject: headerText(0, 255),
  previewText: z.string().trim().max(500),
  fromName: headerText(1, 120),
  fromEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  replyTo: optionalEmail,
  templateId: optionalObjectId,
  audienceMode: z.enum(['all', 'segment', 'selected']),
  segmentId: optionalObjectId,
  subscriberIds: z.array(objectId).max(10000),
  timezone: z.string().trim().min(1).max(100),
  isRecurring: z.boolean(),
  recurrenceInterval: z.coerce.number().int().min(1).max(365),
  recurrenceUnit: z.enum(['day', 'week', 'month']),
  recurrenceEndAt: z.union([z.literal(''), z.string().datetime()]),
  dripTargetAudience: z.enum(['all', 'new_only']),
  dripSteps: z.array(dripStep).max(50),
};

const campaignBody = z
  .object({
    name: campaignFields.name,
    type: campaignFields.type,
    goal: campaignFields.goal.default('clicks'),
    subject: campaignFields.subject.default(''),
    previewText: campaignFields.previewText.default(''),
    fromName: campaignFields.fromName,
    fromEmail: campaignFields.fromEmail,
    replyTo: campaignFields.replyTo.default(''),
    templateId: campaignFields.templateId.default(''),
    audienceMode: campaignFields.audienceMode.default('all'),
    segmentId: campaignFields.segmentId.default(''),
    subscriberIds: campaignFields.subscriberIds.default([]),
    timezone: campaignFields.timezone.default('Asia/Kolkata'),
    isRecurring: campaignFields.isRecurring.default(false),
    recurrenceInterval: campaignFields.recurrenceInterval.default(1),
    recurrenceUnit: campaignFields.recurrenceUnit.default('week'),
    recurrenceEndAt: campaignFields.recurrenceEndAt.default(''),
    dripTargetAudience: campaignFields.dripTargetAudience.default('all'),
    dripSteps: campaignFields.dripSteps.default([]),
  })
  .strict();

const envelope = (body, params = z.object({}).passthrough()) =>
  z.object({
    body,
    params,
    query: z.object({}).passthrough(),
  });

export const createCampaignSchema = envelope(campaignBody);
export const updateCampaignSchema = envelope(
  z
    .object(campaignFields)
    .partial()
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'At least one field is required'),
  z.object({ id: objectId }),
);
export const campaignIdSchema = envelope(
  z.unknown().optional(),
  z.object({ id: objectId }),
);
export const scheduleCampaignSchema = envelope(
  z
    .object({
      scheduledAt: z.string().datetime(),
      timezone: z.string().trim().min(1).max(100).default('Asia/Kolkata'),
    })
    .strict(),
  z.object({ id: objectId }),
);
export const testCampaignEmailSchema = envelope(
  z
    .object({
      recipientEmail: z
        .string()
        .trim()
        .email()
        .max(254)
        .transform((value) => value.toLowerCase()),
      fromName: campaignFields.fromName,
      fromEmail: campaignFields.fromEmail,
      replyTo: campaignFields.replyTo.default(''),
      subject: headerText(1, 255),
      previewText: campaignFields.previewText.default(''),
      templateId: objectId,
    })
    .strict(),
);
export const listCampaignsSchema = z.object({
  body: z.unknown().optional(),
  params: z.object({}).passthrough(),
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      search: z.string().trim().max(200).optional(),
      status: z
        .enum(['all', 'draft', 'active', 'scheduled', 'sending', 'sent', 'paused', 'failed', 'archived'])
        .default('all'),
      type: z
        .enum(['all', 'promotional', 'broadcast', 'newsletter', 'product_launch', 'win_back', 'drip_campaign'])
        .default('all'),
    })
    .passthrough(),
});

export const createDomainSchema = envelope(
  z.object({ domain: z.string().trim().min(3).max(253) }).strict(),
);
export const domainIdSchema = campaignIdSchema;
export const dedicatedIpSchema = envelope(
  z.object({ notes: z.string().trim().max(2000).default('') }).strict(),
  z.object({ id: objectId }),
);
export const senderDefaultsSchema = envelope(
  z
    .object({
      defaultFromName: z.string().trim().min(1).max(120),
      defaultFromEmail: z.string().trim().email().max(254),
      defaultReplyTo: optionalEmail.default(''),
    })
    .strict(),
);
