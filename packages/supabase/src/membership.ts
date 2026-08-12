import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

type Client = SupabaseClient;

export type LuxyMembershipTier = 'free' | 'premium' | 'diamond';
export type LuxyMembershipPeriodCount = 1 | 3;
export type LuxyMembershipOrderStatus =
  | 'awaiting_payment'
  | 'awaiting_confirmation'
  | 'approved'
  | 'rejected'
  | 'cancelled';

const membershipTierSchema = z.enum(['free', 'premium', 'diamond']);
const paidMembershipTierSchema = z.enum(['premium', 'diamond']);
const membershipPeriodSchema = z.union([z.literal(1), z.literal(3)]);
const membershipOrderStatusSchema = z.enum([
  'awaiting_payment',
  'awaiting_confirmation',
  'approved',
  'rejected',
  'cancelled',
]);

const membershipSnapshotSchema = z.object({
  tier: membershipTierSchema,
  can_message: z.boolean(),
  can_favorite: z.boolean(),
  can_request_private_photo: z.boolean(),
  can_full_search: z.boolean(),
  can_unlimited_likes: z.boolean(),
  can_hide_online: z.boolean(),
  can_hide_from_listing: z.boolean(),
  can_use_hearts: z.boolean(),
  visibility_priority: z.coerce.number().int().min(0).max(2),
  heart_balance_units: z.coerce.number().int().nonnegative(),
  status: z.string(),
  expires_at: z.string().nullable(),
});

const membershipPlanOptionSchema = z.object({
  tier: paidMembershipTierSchema,
  period_count: membershipPeriodSchema,
  monthly_price_vnd: z.coerce.number().int().positive(),
  discount_bps: z.coerce.number().int().min(0).max(9_000),
  amount_due_vnd: z.coerce.number().int().positive(),
  heart_credit_units: z.coerce.number().int().nonnegative(),
  heart_credit_display: z.coerce.number().int().nonnegative(),
});

const membershipOrderSchema = z.object({
  order_id: z.string().uuid(),
  order_code: z.string().regex(/^LXM[0-9A-F]{12}$/),
  status: membershipOrderStatusSchema,
  tier: paidMembershipTierSchema,
  period_count: membershipPeriodSchema,
  monthly_price_vnd: z.coerce.number().int().positive(),
  discount_bps: z.coerce.number().int().min(0).max(9_000),
  amount_due_vnd: z.coerce.number().int().positive(),
  heart_credit_units: z.coerce.number().int().nonnegative(),
  created_at: z.string(),
});

const membershipPrivacySchema = z.object({
  hide_online: z.boolean(),
  hide_from_listing: z.boolean(),
  can_hide_online: z.boolean(),
  can_hide_from_listing: z.boolean(),
});

const membershipPrivacyUpdateSchema = z.object({
  hide_online: z.boolean(),
  hide_from_listing: z.boolean(),
});

export type LuxyMembershipSnapshot = z.infer<typeof membershipSnapshotSchema>;
export type LuxyMembershipPlanOption = z.infer<typeof membershipPlanOptionSchema>;
export type LuxyMembershipOrder = z.infer<typeof membershipOrderSchema>;
export type LuxyMembershipPrivacy = z.infer<typeof membershipPrivacySchema>;

export const LUXY_MEMBERSHIP_PLANS = {
  premium: {
    name: 'Cao cấp',
    englishName: 'Premium',
    monthlyPriceVnd: 1_000_000,
    visibilityPriority: 1,
  },
  diamond: {
    name: 'Kim cương',
    englishName: 'Diamond',
    monthlyPriceVnd: 5_000_000,
    visibilityPriority: 2,
  },
} as const;

export const LUXY_THREE_PERIOD_DISCOUNT_BPS = 2_000;
export const LUXY_DIAMOND_HEART_CREDIT_BPS = 8_000;
export const LUXY_HEART_VND_RATE = 50_000;

export async function getMyLuxyMembershipSnapshot(client: Client): Promise<LuxyMembershipSnapshot> {
  const { data, error } = await client.rpc('get_my_luxy_membership_snapshot');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return membershipSnapshotSchema.parse(row);
}

export async function getLuxyMembershipPlanOptions(client: Client): Promise<LuxyMembershipPlanOption[]> {
  const { data, error } = await client.rpc('get_luxy_membership_plan_options');
  if (error) throw error;
  return z.array(membershipPlanOptionSchema).parse(data ?? []);
}

export async function createLuxyMembershipOrder(
  client: Client,
  tier: Exclude<LuxyMembershipTier, 'free'>,
  periodCount: LuxyMembershipPeriodCount,
  requestId: string,
  source = 'membership',
): Promise<LuxyMembershipOrder> {
  const parsedTier = paidMembershipTierSchema.parse(tier);
  const parsedPeriods = membershipPeriodSchema.parse(periodCount);
  const parsedRequestId = z.string().uuid().parse(requestId);
  const parsedSource = z.string().regex(/^[a-z][a-z0-9_]{1,63}$/).parse(source);
  const { data, error } = await client.rpc('create_luxy_membership_order', {
    p_tier: parsedTier,
    p_period_count: parsedPeriods,
    p_request_id: parsedRequestId,
    p_source: parsedSource,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return membershipOrderSchema.parse(row);
}

export async function markLuxyMembershipOrderSubmitted(client: Client, orderId: string): Promise<LuxyMembershipOrderStatus> {
  const { data, error } = await client.rpc('mark_my_luxy_membership_order_submitted', {
    p_order_id: z.string().uuid().parse(orderId),
  });
  if (error) throw error;
  return membershipOrderStatusSchema.parse(data);
}

export async function cancelLuxyMembershipOrder(client: Client, orderId: string): Promise<LuxyMembershipOrderStatus> {
  const { data, error } = await client.rpc('cancel_my_luxy_membership_order', {
    p_order_id: z.string().uuid().parse(orderId),
  });
  if (error) throw error;
  return membershipOrderStatusSchema.parse(data);
}

export async function getMyLuxyMembershipPrivacy(client: Client): Promise<LuxyMembershipPrivacy> {
  const { data, error } = await client.rpc('get_my_luxy_membership_privacy');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return membershipPrivacySchema.parse(row);
}

export async function updateMyLuxyMembershipPrivacy(
  client: Client,
  input: { hideOnline: boolean; hideFromListing: boolean },
): Promise<Pick<LuxyMembershipPrivacy, 'hide_online' | 'hide_from_listing'>> {
  const { data, error } = await client.rpc('update_my_luxy_membership_privacy', {
    p_hide_online: input.hideOnline,
    p_hide_from_listing: input.hideFromListing,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return membershipPrivacyUpdateSchema.parse(row);
}

// Kept for LX-13/LX-15 callers while LX-18 replaces the visual Upgrade/Billing flow.
export async function createLuxyUpgradeIntent(
  client: Client,
  tier: Exclude<LuxyMembershipTier, 'free'>,
  source = 'member_profile',
): Promise<string> {
  const parsedTier = paidMembershipTierSchema.parse(tier);
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

export function calculateLuxyMembershipAmountVnd(
  tier: Exclude<LuxyMembershipTier, 'free'>,
  periodCount: LuxyMembershipPeriodCount,
): number {
  const monthly = LUXY_MEMBERSHIP_PLANS[tier].monthlyPriceVnd;
  const discount = periodCount === 3 ? LUXY_THREE_PERIOD_DISCOUNT_BPS : 0;
  return Math.trunc((monthly * periodCount * (10_000 - discount)) / 10_000);
}

export function calculateLuxyDiamondHeartCreditDisplay(amountPaidVnd: number): number {
  const amount = z.number().int().positive().parse(amountPaidVnd);
  return Math.trunc((amount * LUXY_DIAMOND_HEART_CREDIT_BPS) / 10_000 / LUXY_HEART_VND_RATE);
}

export function formatLuxyHeartBalance(units: number): string {
  const parsedUnits = z.number().int().nonnegative().parse(units);
  return `${new Intl.NumberFormat('vi-VN').format(parsedUnits / 100)} ❤️`;
}
