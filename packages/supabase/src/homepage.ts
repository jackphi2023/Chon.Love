import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

type Client = SupabaseClient<Database>;

const publicFeaturedCreatorSchema = z.object({
  creator_id: z.string().uuid(),
  username: z.string().trim().min(1),
  display_name: z.string().trim().min(1),
  creator_bio: z.string().nullable(),
  avatar_media_id: z.string().uuid().nullable(),
  avatar_bucket: z.string().nullable(),
  avatar_path: z.string().nullable(),
  public_activity_count: z.coerce.number().int().positive(),
  latest_activity_at: z.string().nullable(),
});

const publicActivityHighlightSchema = z.object({
  post_id: z.string().uuid(),
  creator_id: z.string().uuid(),
  username: z.string().trim().min(1),
  display_name: z.string().trim().min(1),
  avatar_media_id: z.string().uuid().nullable(),
  avatar_bucket: z.string().nullable(),
  avatar_path: z.string().nullable(),
  body: z.string().trim().min(1).max(3000),
  content_type: z.enum(['text', 'image', 'video']),
  external_url: z.string().url().nullable(),
  external_provider: z.enum(['youtube', 'of_tv']).nullable(),
  external_video_id: z.string().nullable(),
  published_at: z.string(),
  media_id: z.string().uuid().nullable(),
  media_bucket: z.string().nullable(),
  media_path: z.string().nullable(),
  media_width: z.coerce.number().int().positive().nullable(),
  media_height: z.coerce.number().int().positive().nullable(),
});

export type PublicFeaturedCreator = z.infer<typeof publicFeaturedCreatorSchema>;
export type PublicActivityHighlight = z.infer<typeof publicActivityHighlightSchema>;

export const publicHomepageQueryKeys = {
  all: ['public-homepage'] as const,
  creators: ['public-homepage', 'featured-creators'] as const,
  activity: ['public-homepage', 'activity-highlights'] as const,
};

export function normalizePublicFeaturedCreators(value: unknown): PublicFeaturedCreator[] {
  return z.array(publicFeaturedCreatorSchema).parse(value);
}

export function normalizePublicActivityHighlights(value: unknown): PublicActivityHighlight[] {
  return z.array(publicActivityHighlightSchema).parse(value);
}

export function truncatePublicHomepageText(value: string, maximumLength = 180): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maximumLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maximumLength - 1)).trimEnd()}…`;
}

export async function listPublicFeaturedCreators(
  client: Client,
  limit = 6,
): Promise<PublicFeaturedCreator[]> {
  const { data, error } = await client.rpc(
    'list_public_featured_creators' as never,
    { p_limit: Math.min(Math.max(Math.round(limit), 1), 12) } as never,
  );
  if (error) throw error;
  return normalizePublicFeaturedCreators(data);
}

export async function listPublicActivityHighlights(
  client: Client,
  limit = 6,
): Promise<PublicActivityHighlight[]> {
  const { data, error } = await client.rpc(
    'list_public_activity_highlights' as never,
    { p_limit: Math.min(Math.max(Math.round(limit), 1), 12) } as never,
  );
  if (error) throw error;
  return normalizePublicActivityHighlights(data);
}
