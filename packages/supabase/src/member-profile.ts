import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { resolveChonMemberUsername } from './public-profile';

type Client = SupabaseClient;

const genderSchema = z.enum(['female', 'male', 'non_binary', 'other', 'prefer_not_to_say']);
const datingInterestSchema = z.enum(['female', 'male', 'everyone']);
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
const membershipTierSchema = z.enum(['free', 'premium', 'diamond']);

const memberProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  display_name: z.string().nullable(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  gender: genderSchema,
  interested_in: datingInterestSchema,
  age: z.coerce.number().int().min(18).max(120),
  province_id: z.coerce.number().int().positive().nullable(),
  province_name: z.string().nullable(),
  avatar_media_id: z.string().uuid().nullable(),
  avatar_storage_bucket: z.string().nullable(),
  avatar_storage_path: z.string().nullable(),
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
  member_since: z.string(),
  public_photo_count: z.coerce.number().int().nonnegative(),
  private_photo_count: z.coerce.number().int().nonnegative(),
  membership_tier: membershipTierSchema,
  membership_badge_visible: z.boolean(),
  blocked_by_viewer: z.boolean(),
});

export type LuxyMemberProfile = z.infer<typeof memberProfileSchema>;

export async function getLuxyMemberProfile(client: Client, usernameOrPublicId: string): Promise<LuxyMemberProfile | null> {
  const parsedIdentifier = z.string().trim().min(1).max(48).parse(usernameOrPublicId);
  const resolvedUsername = await resolveChonMemberUsername(client, parsedIdentifier);
  if (!resolvedUsername) return null;
  const { data, error } = await client.rpc('get_luxy_member_profile', { p_username: resolvedUsername });
  if (error) throw error;
  const rows = z.array(memberProfileSchema).parse(data ?? []);
  const row = rows[0];
  if (!row) return null;

  // LX-17: Premium and Diamond badges are server-controlled paid-status signals for
  // every eligible member. Gender must never hide or grant the badge.
  return {
    ...row,
    membership_badge_visible: row.membership_tier !== 'free' && row.membership_badge_visible,
  };
}

export const LUXY_LIFESTYLE_LABELS: Record<LuxyMemberProfile['lifestyle_tags'][number], string> = {
  true_love: 'Tình yêu đích thực',
  luxury_lifestyle: 'Phong cách sống cao cấp',
  active_lifestyle: 'Năng động',
  flexible_schedule: 'Lịch trình linh hoạt',
  emotional_connection: 'Kết nối cảm xúc',
  refined: 'Tinh tế',
  fine_dining: 'Ẩm thực cao cấp',
  friendship: 'Bạn bè',
  long_term: 'Lâu dài',
  marriage_minded: 'Hướng đến hôn nhân',
  monogamous: 'Một vợ một chồng',
  romantic: 'Lãng mạn',
  ready_to_travel: 'Sẵn sàng du lịch',
  travel_companion: 'Bạn đồng hành du lịch',
  vacation: 'Kỳ nghỉ',
  entertainment_events: 'Giải trí & sự kiện',
  platonic: 'Thuần bạn bè',
};