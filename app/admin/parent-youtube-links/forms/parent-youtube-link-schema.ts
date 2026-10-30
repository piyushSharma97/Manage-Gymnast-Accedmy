import { z } from 'zod';

const youtubeUrlRegex =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)[\w-]+/i;

export const ParentYoutubeLinkSchema = z.object({
  link: z
    .string()
    .min(1, 'YouTube link is required')
    .max(500, 'Link must be 500 characters or less')
    .refine(
      (val) => youtubeUrlRegex.test(val),
      'Please enter a valid YouTube URL (e.g. youtube.com/watch?v=..., youtu.be/...)',
    ),
  description: z.string().optional().nullable(),
});

export type ParentYoutubeLinkSchemaType = z.infer<typeof ParentYoutubeLinkSchema>;
