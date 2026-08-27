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

const httpsUrl = z.string().url().refine((value) => value.startsWith('https://'));
const nullableHttpsUrl = httpsUrl.nullable();
const nullableYoutubeUrl = z
  .string()
  .url()
  .refine((value) => {
    try {
      const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
      return hostname === 'youtube.com' || hostname === 'youtu.be';
    } catch {
      return false;
    }
  })
  .nullable();

export const HOMEPAGE_HERO_MAX_SLIDES = 8;

export const homepageHeroSlideSchema = z.object({
  id: z.string().uuid(),
  desktop_url: httpsUrl,
  mobile_url: httpsUrl,
});

export const homepageSettingsSchema = z.object({
  hero_desktop_youtube_url: nullableYoutubeUrl,
  hero_mobile_youtube_url: nullableYoutubeUrl,
  // Defaulting to [] keeps the public homepage backward-compatible during a
  // rolling deploy where the app may briefly read the pre-slider RPC shape.
  hero_slider_images: z.array(homepageHeroSlideSchema).max(HOMEPAGE_HERO_MAX_SLIDES).default([]),
  section2_left_image_url: nullableHttpsUrl,
  section2_right_image_url: nullableHttpsUrl,
  section3_background_image_url: nullableHttpsUrl,
  section4_image_url: nullableHttpsUrl,
  updated_at: z.string(),
});

export type PublicFeaturedCreator = z.infer<typeof publicFeaturedCreatorSchema>;
export type PublicActivityHighlight = z.infer<typeof publicActivityHighlightSchema>;
export type HomepageHeroSlide = z.infer<typeof homepageHeroSlideSchema>;
export type HomepageSettings = z.infer<typeof homepageSettingsSchema>;

export const publicHomepageQueryKeys = {
  all: ['public-homepage'] as const,
  creators: ['public-homepage', 'featured-creators'] as const,
  activity: ['public-homepage', 'activity-highlights'] as const,
  settings: ['public-homepage', 'settings'] as const,
};

const HOMEPAGE_PUBLIC_OBJECT_PREFIX = '/storage/v1/object/public/homepage-public/';
const HOMEPAGE_PUBLIC_RENDER_PREFIX = '/storage/v1/render/image/public/homepage-public/';

const homepageImageWidths = {
  heroDesktop: 1920,
  heroMobile: 900,
  sectionArtwork: 720,
  testimonialBackground: 1920,
  benefitsArtwork: 1200,
} as const;

/**
 * Builds a CDN-backed thumbnail URL only for images owned by the dedicated
 * public homepage bucket. DB/Admin continue storing the original object URL,
 * so editing, replacement and future reprocessing never lose the source file.
 * Width-only transforms preserve the uploaded aspect ratio; the RN view still
 * owns cover/contain presentation.
 */
export function homepageThumbnailUrl(
  value: string | null | undefined,
  width: number,
  quality = 80,
): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (!hostname.endsWith('.supabase.co') || !url.pathname.startsWith(HOMEPAGE_PUBLIC_OBJECT_PREFIX)) {
      return value;
    }

    url.pathname = url.pathname.replace(HOMEPAGE_PUBLIC_OBJECT_PREFIX, HOMEPAGE_PUBLIC_RENDER_PREFIX);
    url.searchParams.set('width', String(Math.min(Math.max(Math.round(width), 1), 2500)));
    url.searchParams.set('quality', String(Math.min(Math.max(Math.round(quality), 20), 100)));
    return url.toString();
  } catch {
    return value;
  }
}

export function optimizePublicHomepageSettings(settings: HomepageSettings): HomepageSettings {
  return {
    ...settings,
    hero_slider_images: settings.hero_slider_images.map((slide) => ({
      ...slide,
      desktop_url: homepageThumbnailUrl(slide.desktop_url, homepageImageWidths.heroDesktop, 80) ?? slide.desktop_url,
      mobile_url: homepageThumbnailUrl(slide.mobile_url, homepageImageWidths.heroMobile, 80) ?? slide.mobile_url,
    })),
    section2_left_image_url: homepageThumbnailUrl(
      settings.section2_left_image_url,
      homepageImageWidths.sectionArtwork,
      82,
    ),
    section2_right_image_url: homepageThumbnailUrl(
      settings.section2_right_image_url,
      homepageImageWidths.sectionArtwork,
      82,
    ),
    section3_background_image_url: homepageThumbnailUrl(
      settings.section3_background_image_url,
      homepageImageWidths.testimonialBackground,
      78,
    ),
    section4_image_url: homepageThumbnailUrl(
      settings.section4_image_url,
      homepageImageWidths.benefitsArtwork,
      82,
    ),
  };
}

export function normalizePublicFeaturedCreators(value: unknown): PublicFeaturedCreator[] {
  return z.array(publicFeaturedCreatorSchema).parse(value);
}

export function normalizePublicActivityHighlights(value: unknown): PublicActivityHighlight[] {
  return z.array(publicActivityHighlightSchema).parse(value);
}

export function normalizeHomepageSettings(value: unknown): HomepageSettings {
  const row = Array.isArray(value) ? value[0] : value;
  return homepageSettingsSchema.parse(row);
}

export function shouldUseHomepageHeroSlider(
  settings: Pick<HomepageSettings, 'hero_slider_images'> | null | undefined,
): boolean {
  return (settings?.hero_slider_images.length ?? 0) > 0;
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

export async function getPublicHomepageSettings(client: Client): Promise<HomepageSettings> {
  const { data, error } = await client.rpc('get_public_homepage_settings' as never);
  if (error) throw error;
  return optimizePublicHomepageSettings(normalizeHomepageSettings(data));
}

export async function getAdminHomepageSettings(client: Client, actorUserId: string): Promise<HomepageSettings> {
  const { data, error } = await client.rpc(
    'admin_get_homepage_settings' as never,
    { p_actor_user_id: z.string().uuid().parse(actorUserId) } as never,
  );
  if (error) throw error;
  return normalizeHomepageSettings(data);
}

export async function updateAdminHomepageSettings(
  client: Client,
  actorUserId: string,
  input: Omit<HomepageSettings, 'updated_at'>,
): Promise<HomepageSettings> {
  const parsed = homepageSettingsSchema.omit({ updated_at: true }).parse(input);
  const { data, error } = await client.rpc(
    'admin_publish_homepage_settings' as never,
    {
      p_actor_user_id: z.string().uuid().parse(actorUserId) } as never,
  );
  if (error) throw error;
  return normalizeHomepageSettings(data);
}
