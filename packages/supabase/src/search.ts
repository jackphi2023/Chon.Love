import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type {
  ChildrenStatus,
  DrinkingStatus,
  EducationLevel,
  GenderIdentity,
  ProfileLifestyleTag,
  RelationshipStatus,
  SmokingStatus,
} from './profile-media';

// Search V2 is runtime-validated with zod. LX-12 extends the RPC before the next
// generated Supabase type checkpoint, so keep this call boundary structural.
type Client = SupabaseClient;

export const LUXY_SEARCH_DEFAULT_PAGE_SIZE = 24;
export const LUXY_SEARCH_MAX_PAGE_SIZE = 40;
export const LUXY_SEARCH_MAX_RESULTS = 200;
export const LUXY_SEARCH_MAX_DISTANCE_KM = 3000;

export type LuxySearchSort = 'distance' | 'recent' | 'newest';
export type LuxySearchViewState = 'viewed' | 'unviewed';
export type LuxySearchFavoriteScope = 'favorites' | 'favorited_me';

export type LuxySearchFilters = {
  provinceId?: number | null;
  maxDistanceKm?: number | null;
  minAge?: number;
  maxAge?: number;
  genders?: GenderIdentity[];
  minHeightCm?: number | null;
  maxHeightCm?: number | null;
  minWeightKg?: number | null;
  maxWeightKg?: number | null;
  relationshipStatuses?: RelationshipStatus[];
  childrenStatuses?: ChildrenStatus[];
  smokingStatuses?: SmokingStatus[];
  drinkingStatuses?: DrinkingStatus[];
  educationLevels?: EducationLevel[];
  lifestyleTags?: ProfileLifestyleTag[];
  languages?: string[];
  interests?: string[];
  hasPhoto?: boolean | null;
  onlineNow?: boolean | null;
  occupationText?: string | null;
  profileText?: string | null;
  viewState?: LuxySearchViewState | null;
  favoriteScope?: LuxySearchFavoriteScope | null;
};

export type SearchLuxyProfilesInput = LuxySearchFilters & {
  sort?: LuxySearchSort;
  limit?: number;
  offset?: number;
};

type DiscoverySearchContext = {
  province_id?: unknown;
  has_fresh_location?: unknown;
};

const genderSchema = z.enum(['female', 'male', 'non_binary', 'other', 'prefer_not_to_say']);
const relationshipSchema = z.enum(['single', 'divorced', 'widowed', 'open', 'complicated', 'prefer_not_to_say']);
const childrenSchema = z.enum(['no_children', 'has_children', 'prefer_not_to_say']);
const smokingSchema = z.enum(['never', 'socially', 'regularly', 'trying_to_quit', 'prefer_not_to_say']);
const drinkingSchema = z.enum(['never', 'socially', 'regularly', 'prefer_not_to_say']);
const educationSchema = z.enum(['high_school', 'vocational', 'college', 'bachelors', 'masters', 'doctorate', 'other', 'prefer_not_to_say']);
const lifestyleTagSchema = z.enum([
  'true_love', 'luxury_lifestyle', 'active_lifestyle', 'flexible_schedule',
  'emotional_connection', 'refined', 'fine_dining', 'friendship', 'long_term',
  'marriage_minded', 'monogamous', 'romantic', 'ready_to_travel',
  'travel_companion', 'vacation', 'entertainment_events', 'platonic',
]);
const viewStateSchema = z.enum(['viewed', 'unviewed']);
const favoriteScopeSchema = z.enum(['favorites', 'favorited_me']);

const luxySearchProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  gender: genderSchema,
  age: z.coerce.number().int().min(18).max(120),
  province_id: z.coerce.number().int().positive().nullable(),
  province_name: z.string().nullable(),
  avatar_media_id: z.string().uuid().nullable(),
  avatar_storage_bucket: z.string().nullable(),
  avatar_storage_path: z.string().nullable(),
  photo_count: z.coerce.number().int().nonnegative(),
  interests: z.array(z.string()),
  height_cm: z.coerce.number().int().nullable(),
  weight_kg: z.coerce.number().int().nullable(),
  relationship_status: relationshipSchema,
  children_status: childrenSchema,
  smoking_status: smokingSchema,
  drinking_status: drinkingSchema,
  education_level: educationSchema,
  occupation: z.string().nullable(),
  looking_for: z.string().nullable(),
  lifestyle_tags: z.array(lifestyleTagSchema),
  languages: z.array(z.string()),
  last_active_at: z.string().nullable(),
  is_online: z.boolean(),
  distance_km: z.coerce.number().nonnegative().nullable(),
  member_since: z.string(),
  is_favorited: z.boolean(),
  is_favorited_by: z.boolean(),
  is_viewed: z.boolean(),
});

const searchInputSchema = z.object({
  sort: z.enum(['distance', 'recent', 'newest']).default('distance'),
  provinceId: z.number().int().positive().nullable().optional(),
  maxDistanceKm: z.number().positive().max(LUXY_SEARCH_MAX_DISTANCE_KM).nullable().optional(),
  minAge: z.number().int().min(18).max(99).default(18),
  maxAge: z.number().int().min(18).max(99).default(99),
  genders: z.array(genderSchema).max(5).optional(),
  minHeightCm: z.number().int().min(120).max(230).nullable().optional(),
  maxHeightCm: z.number().int().min(120).max(230).nullable().optional(),
  minWeightKg: z.number().int().min(35).max(250).nullable().optional(),
  maxWeightKg: z.number().int().min(35).max(250).nullable().optional(),
  relationshipStatuses: z.array(relationshipSchema).max(6).optional(),
  childrenStatuses: z.array(childrenSchema).max(3).optional(),
  smokingStatuses: z.array(smokingSchema).max(5).optional(),
  drinkingStatuses: z.array(drinkingSchema).max(4).optional(),
  educationLevels: z.array(educationSchema).max(8).optional(),
  lifestyleTags: z.array(lifestyleTagSchema).max(12).optional(),
  languages: z.array(z.string().trim().min(2).max(32)).max(8).optional(),
  interests: z.array(z.string().trim().min(2).max(32)).max(12).optional(),
  hasPhoto: z.boolean().nullable().optional(),
  onlineNow: z.boolean().nullable().optional(),
  occupationText: z.string().trim().max(120).nullable().optional(),
  profileText: z.string().trim().max(120).nullable().optional(),
  viewState: viewStateSchema.nullable().optional(),
  favoriteScope: favoriteScopeSchema.nullable().optional(),
  limit: z.number().int().min(1).max(LUXY_SEARCH_MAX_PAGE_SIZE).default(LUXY_SEARCH_DEFAULT_PAGE_SIZE),
  offset: z.number().int().min(0).max(LUXY_SEARCH_MAX_RESULTS - 1).default(0),
}).superRefine((input, ctx) => {
  if (input.minAge > input.maxAge) ctx.addIssue({ code: 'custom', message: 'invalid_search_age_range' });
  if (input.minHeightCm !== null && input.minHeightCm !== undefined && input.maxHeightCm !== null && input.maxHeightCm !== undefined && input.minHeightCm > input.maxHeightCm) {
    ctx.addIssue({ code: 'custom', message: 'invalid_search_height_range' });
  }
  if (input.minWeightKg !== null && input.minWeightKg !== undefined && input.maxWeightKg !== null && input.maxWeightKg !== undefined && input.minWeightKg > input.maxWeightKg) {
    ctx.addIssue({ code: 'custom', message: 'invalid_search_weight_range' });
  }
});

export type LuxySearchProfile = z.infer<typeof luxySearchProfileSchema>;

export function parseLuxySearchInput(input: SearchLuxyProfilesInput = {}) {
  return searchInputSchema.parse(input);
}

// Kept as a public helper for source compatibility. Locality fallback now lives
// in Search V2 itself so the default Connect feed needs only one network round-trip.
export function resolveLuxySearchDefaultProvince(
  requestedProvinceId: number | null | undefined,
  _sort: LuxySearchSort,
  _context: DiscoverySearchContext | null | undefined,
): number | null {
  return requestedProvinceId ?? null;
}

export async function searchLuxyProfilesV2(
  client: Client,
  input: SearchLuxyProfilesInput = {},
): Promise<LuxySearchProfile[]> {
  const parsed = parseLuxySearchInput(input);
  const args = {
    p_sort: parsed.sort,
    p_min_age: parsed.minAge,
    p_max_age: parsed.maxAge,
    p_limit: parsed.limit,
    p_offset: parsed.offset,
    ...(parsed.provinceId == null ? {} : { p_province_id: parsed.provinceId }),
    ...(parsed.maxDistanceKm == null ? {} : { p_max_distance_km: parsed.maxDistanceKm }),
    ...(parsed.genders?.length ? { p_genders: parsed.genders } : {}),
    ...(parsed.minHeightCm == null ? {} : { p_min_height_cm: parsed.minHeightCm }),
    ...(parsed.maxHeightCm == null ? {} : { p_max_height_cm: parsed.maxHeightCm }),
    ...(parsed.minWeightKg == null ? {} : { p_min_weight_kg: parsed.minWeightKg }),
    ...(parsed.maxWeightKg == null ? {} : { p_max_weight_kg: parsed.maxWeightKg }),
    ...(parsed.relationshipStatuses?.length ? { p_relationship_statuses: parsed.relationshipStatuses } : {}),
    ...(parsed.childrenStatuses?.length ? { p_children_statuses: parsed.childrenStatuses } : {}),
    ...(parsed.smokingStatuses?.length ? { p_smoking_statuses: parsed.smokingStatuses } : {}),
    ...(parsed.drinkingStatuses?.length ? { p_drinking_statuses: parsed.drinkingStatuses } : {}),
    ...(parsed.educationLevels?.length ? { p_education_levels: parsed.educationLevels } : {}),
    ...(parsed.lifestyleTags?.length ? { p_lifestyle_tags: parsed.lifestyleTags } : {}),
    ...(parsed.languages?.length ? { p_languages: parsed.languages } : {}),
    ...(parsed.interests?.length ? { p_interests: parsed.interests } : {}),
    ...(parsed.hasPhoto == null ? {} : { p_has_photo: parsed.hasPhoto }),
    ...(parsed.onlineNow == null ? {} : { p_online_now: parsed.onlineNow }),
    ...(parsed.occupationText ? { p_occupation_text: parsed.occupationText } : {}),
    ...(parsed.profileText ? { p_profile_text: parsed.profileText } : {}),
    ...(parsed.viewState ? { p_view_state: parsed.viewState } : {}),
    ...(parsed.favoriteScope ? { p_favorite_scope: parsed.favoriteScope } : {}),
  };
  const { data, error } = await client.rpc('search_luxy_profiles_v2', args);
  if (error) throw error;
  return z.array(luxySearchProfileSchema).parse(data ?? []);
}

export function formatLuxyDistance(distanceKm: number | null | undefined): string | null {
  if (distanceKm === null || distanceKm === undefined || !Number.isFinite(distanceKm) || distanceKm < 0) return null;
  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

export function getNextLuxySearchOffset(
  pageLengths: number[],
  pageSize = LUXY_SEARCH_DEFAULT_PAGE_SIZE,
  maxResults = LUXY_SEARCH_MAX_RESULTS,
): number | undefined {
  const loaded = pageLengths.reduce((sum, count) => sum + count, 0);
  const last = pageLengths.at(-1);
  if (loaded >= maxResults || (last !== undefined && last < pageSize)) return undefined;
  return loaded;
}
