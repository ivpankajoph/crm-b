import { z } from 'zod';

const optionalEmail = z.union([
  z.literal(''),
  z.string().trim().email('Enter a valid email address').max(254),
]);

export const updateWorkspaceSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      settings: z
        .object({
          timezone: z.string().trim().min(1).max(100).optional(),
          defaultFromName: z.string().trim().max(120).optional(),
          defaultFromEmail: optionalEmail.optional(),
          defaultReplyTo: optionalEmail.optional(),
          trackingEnabled: z.boolean().optional(),
          unsubscribeFooterEnabled: z.boolean().optional(),
        })
        .strict()
        .optional(),
    })
    .strict()
    .refine(
      (body) => body.name !== undefined || body.settings !== undefined,
      'At least one workspace field is required',
    ),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});
