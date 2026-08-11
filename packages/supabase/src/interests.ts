import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// LX-12 RPCs intentionally use a runtime-validated boundary instead of hand-editing
// generated database.types.ts between Supabase type-generation checkpoints.
type Client = SupabaseClient;

export const LUXY_INTERESTS_DEFAULT_PAGE_SIZE = 24;
export const LUXY_INTERESTS_MAX_RESULTS = 200;

export type LuxyInterestScope = 'favorites' | 'viewed_me' | 'favorited_me';

const uuidSchema = z.string().uuid();
const usernameSchema = z.string().trim().min(1).max(48);
const interestScopeSchema = z.enum(['favorites', 'viewed_me', 'favorited_me']);

const favoriteStateSchema = z.object({
  is_favorited: z.boolean(),
  is_favorited_by: z.boolean(),
  is_match: z.boolean(),
});

const profileInterestStateSchema = favoriteStateSchema.extend({
  is_viewed: z.boolean(),
  has_viewed_me: z.boolean(),
});

const interestMemberSchema = z.object({
  id: uuidSchema,
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  age: z.coerce.number().int().min(18).max(120),
  province_name: z.string().nullable(),
  avatar_media_id: uuidSchema.nullable(),
  avatar_storage_bucket: z.string().nullable(),
  avatar_storage_path: z.string().nullable(),
  photo_count: z.coerce.number().int().nonnegative(),
  last_active_at: z.string().nullable(),
  is_online: z.boolean(),
  is_favorited: z.boolean(),
  is_favorited_by: z.boolean(),
  is_match: z.boolean(),
  interaction_at: z.string(),
});

export type LuxyFavoriteState = z.infer<typeof favoriteStateSchema>;
export type LuxyProfileInterestState = z.infer<typeof profileInterestStateSchema>;
export type LuxyInterestMember = z.infer<typeof interestMemberSchema>;

function parseProfileId(profileId: string): string {
  return uuidSchema.parse(profileId);
}

export function parseLuxyInterestScope(scope: string): LuxyInterestScope {
  return interestScopeSchema.parse(scope);
}

export async function setProfileFavorite(
  client: Client,
  profileId: string,
  favorited: boolean,
): Promise<LuxyFavoriteState> {
  const { data, error } = await client.rpc('set_profile_favorite', {
    p_profile_id: parseProfileId(profileId),
    p_favorited: favorited,
  });
  if (error) throw error;
  return favoriteStateSchema.parse(Array.isArray(data) ? data[0] : data);
}

export async function getProfileInterestState(
  client: Client,
  profileId: string,
): Promise<LuxyProfileInterestState> {
  const { data, error } = await client.rpc('get_profile_interest_state', {
    p_profile_id: parseProfileId(profileId),
  });
  if (error) throw error;
  return profileInterestStateSchema.parse(Array.isArray(data) ? data[0] : data);
}

export async function recordProfileView(client: Client, profileId: string): Promise<boolean> {
  const { data, error } = await client.rpc('record_profile_view', {
    p_profile_id: parseProfileId(profileId),
  });
  if (error) throw error;
  return z.boolean().parse(data);
}

export async function recordProfileViewByUsername(client: Client, username: string): Promise<boolean> {
  const { data, error } = await client.rpc('record_profile_view_by_username', {
    p_username: usernameSchema.parse(username),
  });
  if (error) throw error;
  return z.boolean().parse(data);
}

export async function listLuxyInterests(
  client: Client,
  scope: LuxyInterestScope,
  options: { limit?: number; offset?: number } = {},
): Promise<LuxyInterestMember[]> {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? LUXY_INTERESTS_DEFAULT_PAGE_SIZE), 1), 40);
  const offset = Math.min(Math.max(Math.trunc(options.offset ?? 0), 0), LUXY_INTERESTS_MAX_RESULTS - 1);
  const { data, error } = await client.rpc('list_luxy_interests', {
    p_scope: parseLuxyInterestScope(scope),
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return z.array(interestMemberSchema).parse(data ?? []);
}

export function getNextLuxyInterestsOffset(
  pageLengths: number[],
  pageSize = LUXY_INTERESTS_DEFAULT_PAGE_SIZE,
  maxResults = LUXY_INTERESTS_MAX_RESULTS,
): number | undefined {
  const loaded = pageLengths.reduce((sum, length) => sum + length, 0);
  const last = pageLengths.at(-1);
  if (loaded >= maxResults || (last !== undefined && last < pageSize)) return undefined;
  return loaded;
}
