import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

type Client = SupabaseClient;

export type LuxyMembershipTier = 'free' | 'premium' | 'diamond';

const membershipTierSchema = z.enum(['free', 'premium', 'diamond']);
const membershipSnapshotSchema = z.object({
  tier: membershipTierSchema,
  can_message: z.boolean(),
  status: z.string(),
  expires_at: z.string().nullable(),
});

export type LuxyMembershipSnapshot = z.infer<typeof membershipSnapshotSchema>;

export const LUXY_MEMBERSHIP_PLANS = {
  premium: {
    name: 'Premium',
    monthlyPriceVnd: 1_000_000,
  },
  diamond: {
    name: 'Diamond',
    monthlyPriceVnd: 5_000_000,
  },
} as const;

export async function getMyLuxyMembershipSnapshot(client: Client): Promise<LuxyMembershipSnapshot> {
  const { data, error } = await client.rpc('get_my_luxy_membership_snapshot');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return membershipSnapshotSchema.parse(row);
}

export async function createLuxyUpgradeIntent(
  client: Client,
  tier: Exclude<LuxyMembershipTier, 'free'>,
  source = 'member_profile',
): Promise<string> {
  const parsedTier = membershipTierSchema.exclude(['free']).parse(tier);
  const parsedSource = z.string().regex(/^[a-z][a-z0-9_]{1,63}$/).parse(source);
  const { data, error } = await client.rpc('create_luxy_upgrade_intent', {
    p_tier: parsedTier,
    p_source: parsedSource,
  });
  if (error) throw error;
  return z.string().uuid().parse(data);
}

export function formatLuxyMembershipPrice(tier: Exclude<LuxyMembershipTier, 'free'>): string {
  const amount = LUXY_MEMBERSHIP_PLANS[tier].monthlyPriceVnd;
  return `${new Intl.NumberFormat('vi-VN').format(amount)} đ / tháng`;
}
