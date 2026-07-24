import { z } from 'zod';

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid resource id');

const block = z
  .object({
    id: z.string().trim().min(1).max(100).optional(),
    type: z.enum([
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
    ]),
    content: z.string().max(250000).default(''),
    href: z.string().trim().max(2048).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    alt: z.string().trim().max(500).optional(),
    imageUrl: z.string().trim().max(2048).optional(),
    subtitle: z.string().max(5000).optional(),
    price: z.string().trim().max(100).optional(),
    buttonText: z.string().trim().max(120).optional(),
    items: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(80),
            url: z.string().trim().max(2048),
          })
          .strict(),
      )
      .max(12)
      .optional(),
  })
  .strict();

const templateFields = {
  name: z.string().trim().min(2).max(120),
  subject: z.string().trim().max(255),
  preheader: z.string().trim().max(500),
  type: z.enum(['visual', 'simple', 'html']),
  status: z.enum(['draft', 'active', 'archived']),
  category: z.string().trim().min(1).max(80),
  htmlContent: z.string().max(1000000),
  blocks: z.array(block).max(200),
};

const templateBody = z
  .object({
    name: templateFields.name,
    subject: templateFields.subject.default(''),
    preheader: templateFields.preheader.default(''),
    type: templateFields.type.default('visual'),
    status: templateFields.status.default('draft'),
    category: templateFields.category.default('General'),
    htmlContent: templateFields.htmlContent.default(''),
    blocks: templateFields.blocks.default([]),
  })
  .strict();

const envelope = (body, params = z.object({}).passthrough()) =>
  z.object({
    body,
    params,
    query: z.object({}).passthrough(),
  });

export const listTemplatesSchema = z.object({
  body: z.unknown().optional(),
  params: z.object({}).passthrough(),
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      search: z.string().trim().max(200).optional(),
      type: z.enum(['all', 'visual', 'simple', 'html']).default('all'),
      status: z.enum(['all', 'draft', 'active', 'archived']).default('all'),
      category: z.string().trim().max(80).optional(),
    })
    .passthrough(),
});

export const createTemplateSchema = envelope(templateBody);
export const updateTemplateSchema = envelope(
  z
    .object(templateFields)
    .partial()
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'At least one field is required'),
  z.object({ id: objectId }),
);
export const templateIdSchema = envelope(
  z.unknown().optional(),
  z.object({ id: objectId }),
);

export const dataUrlUploadSchema = envelope(
  z
    .object({
      dataUrl: z.string().min(1).max(7500000),
      filename: z.string().trim().min(1).max(120).default('image'),
    })
    .strict(),
);
