import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

type Client = SupabaseClient<Database>;

export const DISCOVERY_CACHE_MS = 30 * 60 * 1_000;
export const DISCOVERY_DEFAULT_PAGE_SIZE = 24;
export const DISCOVERY_MAX_RESULTS = 200;
export const DISCOVERY_AVATAR_URL_SECONDS = 120;

export type DiscoveryMode = 'nearby' | 'province';

const discoveryContextSchema = z.object({
  user_id: z.string().uuid(),
  province_id: z.coerce.number().int().positive().nullable(),
  discovery_enabled: z.boolean(),
  nearby_enabled: z.boolean(),
  has_fresh_location: z.boolean(),
  location_captured_at: z.string().nullable(),
  cache_minutes: z.coerce.number().int().min(1).max(24 * 60),
  page_size: z.coerce.number().int().min(1).max(40),
  max_results: z.coerce.number().int().min(1).max(DISCOVERY_MAX_RESULTS),
});

const discoveryProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  bio: z.string().nullable(),
  gender: z.enum(['female', 'male', 'non_binary', 'other', 'prefer_not_to_say']),
  province_id: z.coerce.number().int().positive().nullable(),
  province_name: z.string().nullable(),
  avatar_media_id: z.string().uuid().nullable(),
  avatar_storage_bucket: z.string().nullable(),
  avatar_storage_path: z.string().nullable(),
  is_creator: z.boolean(),
  interests: z.array(z.string()),
  last_active_at: z.string().nullable(),
  distance_km: z.coerce.number().nonnegative().nullable(),
  sort_tier: z.coerce.number().int().min(0).max(2),
});

export type DiscoveryContext = z.infer<typeof discoveryContextSchema>;
export type DiscoveryProfile = z.infer<typeof discoveryProfileSchema>;

export type SetMyLocationInput = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
  source: 'device_foreground' | 'device_approximate';
};

export type DiscoveryPageInput = {
  mode: DiscoveryMode;
  provinceId?: number | null;
  limit?: number;
  offset?: number;
};

export async function getMyDiscoveryContext(client: Client): Promise<DiscoveryContext> {
  const { data, error } = await client.rpc('get_my_discovery_context' as never);
  if (error) throw error;
  const rows = z.array(discoveryContextSchema).parse(data);
  const row = rows[0];
  if (!row) throw new Error('discovery_context_not_available');
  return row;
}

export async function listDiscoveryProfiles(
  client: Client,
  input: DiscoveryPageInput,
): Promise<DiscoveryProfile[]> {
  const { data, error } = await client.rpc(
    'list_discovery_profiles' as never,
    {
      p_mode: input.mode,
      p_province_id: input.provinceId ?? null,
      p_limit: input.limit ?? DISCOVERY_DEFAULT_PAGE_SIZE,
      p_offset: input.offset ?? 0,
    } as never,
  );
  if (error) throw error;
  return z.array(discoveryProfileSchema).parse(data);
}

export async function setMyDiscoveryLocation(
  client: Client,
  input: SetMyLocationInput,
): Promise<void> {
  const { error } = await client.rpc('set_my_location', {
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_accuracy_meters: Math.max(0, Math.round(input.accuracyMeters)),
    p_captured_at: input.capturedAt,
    p_source: input.source,
  });
  if (error) throw error;
}

export async function disableMyDiscoveryLocation(client: Client): Promise<void> {
  const { error } = await client.rpc('disable_my_location');
  if (error) throw error;
}

export function formatApproximateDistance(distanceKm: number | null | undefined): string | null {
  if (distanceKm === null || distanceKm === undefined || !Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) return '< 1 km';
  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

export function getNextDiscoveryOffset(
  pageLengths: readonly number[],
  pageSize = DISCOVERY_DEFAULT_PAGE_SIZE,
  maxResults = DISCOVERY_MAX_RESULTS,
): number | undefined {
  const loaded = pageLengths.reduce((total, length) => total + length, 0);
  const lastPageLength = pageLengths.at(-1) ?? 0;
  if (loaded >= maxResults || lastPageLength < pageSize) return undefined;
  return loaded;
}

export function deduplicateDiscoveryProfiles(
  profiles: readonly DiscoveryProfile[],
): DiscoveryProfile[] {
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    if (seen.has(profile.id)) return false;
    seen.add(profile.id);
    return true;
  });
}
