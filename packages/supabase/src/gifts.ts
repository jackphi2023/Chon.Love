import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

const HEART_UNITS_PER_HEART = 100;
export const SESSION_19_GIFT_COUNT = 20;
export const LUXY_GIFT_HOLD_DAYS = 7;

const giftCatalogItemSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  name_vi: z.string().trim().min(1).max(80),
  name_en: z.string().trim().min(1).max(80),
  icon_emoji: z.string().trim().min(1).max(16),
  icon_media_id: z.string().uuid().nullable(),
  heart_price_units: z.coerce.number().int().positive(),
  display_hearts: z.coerce.number().int().positive(),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().nonnegative(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

const economySummarySchema = z.object({
  heart_available_units: z.coerce.number().int().nonnegative(),
});

const luxyGiftSendResultSchema = z.object({
  gift_transaction_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  gift_id: z.string().uuid(),
  quantity: z.coerce.number().int().positive().max(100),
  gross_heart_units: z.coerce.number().int().positive(),
  recipient_reward_units: z.coerce.number().int().nonnegative(),
  platform_gross_units: z.coerce.number().int().nonnegative(),
  sender_balance_units: z.coerce.number().int().nonnegative(),
  reward_available_at: z.string(),
  message_id: z.string().uuid().nullable(),
  already_processed: z.boolean(),
});

const luxyGiftWalletSchema = z.object({
  can_gift: z.boolean(),
  heart_available_units: z.coerce.number().int().nonnegative(),
  reward_pending_units: z.coerce.number().int().nonnegative(),
  reward_available_units: z.coerce.number().int().nonnegative(),
  reward_held_units: z.coerce.number().int().nonnegative(),
  reward_paid_units: z.coerce.number().int().nonnegative(),
  reward_reversed_units: z.coerce.number().int().nonnegative(),
  reward_frozen: z.boolean(),
  reward_hold_days: z.literal(LUXY_GIFT_HOLD_DAYS),
  recipient_share_bps: z.coerce.number().int().min(0).max(10_000),
  platform_share_bps: z.coerce.number().int().min(0).max(10_000),
  minimum_withdrawal_units: z.coerce.number().int().positive(),
  kyc_approved: z.boolean(),
  verified_bank_available: z.boolean(),
  withdrawal_ready: z.boolean(),
});

const luxyGiftHistoryDirectionSchema = z.enum(['received', 'sent']);
const luxyGiftHistoryItemSchema = z.object({
  gift_transaction_id: z.string().uuid(),
  direction: luxyGiftHistoryDirectionSchema,
  other_user_id: z.string().uuid(),
  other_username: z.string().nullable(),
  other_display_name: z.string().nullable(),
  gift_slug: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  gift_name_vi: z.string().trim().min(1).max(80),
  gift_icon_emoji: z.string().trim().min(1).max(16).nullable(),
  quantity: z.coerce.number().int().positive().max(100),
  gross_heart_units: z.coerce.number().int().positive(),
  recipient_reward_units: z.coerce.number().int().nonnegative(),
  reward_available_at: z.string().nullable(),
  status: z.enum(['completed', 'partially_reversed', 'reversed']),
  message_id: z.string().uuid().nullable(),
  created_at: z.string(),
});

export type GiftCatalogItem = z.infer<typeof giftCatalogItemSchema>;
export type LuxyGiftSendResult = z.infer<typeof luxyGiftSendResultSchema>;
export type GiftSendResult = LuxyGiftSendResult & {
  /** @deprecated LX-19 recipient semantics use recipient_id. */
  creator_id: string;
  /** @deprecated LX-19 recipient semantics use recipient_reward_units. */
  creator_reward_units: number;
  /** Legacy Fan fields remain shape-compatible only; LX-19 never promotes Fan state from gifts. */
  fan_eligible_units: number;
  fan_threshold_units: number;
  fan_status: 'none' | 'active';
};
export type LuxyGiftWallet = z.infer<typeof luxyGiftWalletSchema>;
export type LuxyGiftHistoryDirection = z.infer<typeof luxyGiftHistoryDirectionSchema>;
export type LuxyGiftHistoryItem = z.infer<typeof luxyGiftHistoryItemSchema>;
export type GiftCatalogContractIssue = {
  code: 'count' | 'display_hearts' | 'heart_price_units' | 'sort_order' | 'duplicate';
  message: string;
};

type Client = SupabaseClient<Database>;

export const giftCatalogQueryKeys = {
  all: ['gift-catalog'] as const,
  active: ['gift-catalog', 'active'] as const,
  balance: (userId: string | null) => ['gift-catalog', 'balance', userId] as const,
  wallet: (userId: string | null) => ['luxy-gift-wallet', userId] as const,
  history: (userId: string | null, direction: LuxyGiftHistoryDirection) =>
    ['luxy-gift-history', userId, direction] as const,
};

export function normalizeGiftCatalog(input: unknown): GiftCatalogItem[] {
  return z
    .array(giftCatalogItemSchema)
    .parse(input)
    .filter((gift) => gift.is_active && gift.deleted_at === null)
    .sort((left, right) => left.sort_order - right.sort_order || left.id.localeCompare(right.id));
}

export function getGiftCatalogContractIssues(
  gifts: readonly GiftCatalogItem[],
): GiftCatalogContractIssue[] {
  const issues: GiftCatalogContractIssue[] = [];
  if (gifts.length !== SESSION_19_GIFT_COUNT) {
    issues.push({
      code: 'count',
      message: `Catalog must contain exactly ${SESSION_19_GIFT_COUNT} active gifts.`,
    });
  }

  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const [index, gift] of gifts.entries()) {
    const expected = index + 1;
    if (ids.has(gift.id) || slugs.has(gift.slug)) {
      issues.push({ code: 'duplicate', message: `Gift ${gift.slug} has a duplicate id or slug.` });
    }
    ids.add(gift.id);
    slugs.add(gift.slug);

    if (gift.display_hearts !== expected) {
      issues.push({
        code: 'display_hearts',
        message: `Gift ${gift.slug} must display ${expected} hearts.`,
      });
    }
    if (gift.heart_price_units !== expected * HEART_UNITS_PER_HEART) {
      issues.push({
        code: 'heart_price_units',
        message: `Gift ${gift.slug} must cost ${expected * HEART_UNITS_PER_HEART} heart units.`,
      });
    }
    if (gift.sort_order !== expected) {
      issues.push({
        code: 'sort_order',
        message: `Gift ${gift.slug} must have sort order ${expected}.`,
      });
    }
  }
  return issues;
}

export function formatGiftHeartPrice(gift: Pick<GiftCatalogItem, 'display_hearts'>): string {
  return `${gift.display_hearts.toLocaleString('vi-VN')} ❤️`;
}

export function formatHeartUnitBalance(units: number): string {
  const hearts = Math.max(0, Math.round(units)) / HEART_UNITS_PER_HEART;
  const formatted = Number.isInteger(hearts)
    ? hearts.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
    : hearts.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${formatted} ❤️`;
}

export function formatGiftAvailabilityDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export function createGiftIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function listActiveGiftCatalog(client: Client): Promise<GiftCatalogItem[]> {
  const { data, error } = await client
    .from('gift_catalog')
    .select(
      'id,slug,name_vi,name_en,icon_emoji,icon_media_id,heart_price_units,display_hearts,is_active,sort_order,updated_at,deleted_at',
    )
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return normalizeGiftCatalog(data);
}

export async function getMyAvailableHeartUnits(client: Client): Promise<number> {
  const { data, error } = await client.rpc('get_my_economy_summary');
  if (error) throw error;
  const summary = z.array(economySummarySchema).parse(data)[0];
  return summary?.heart_available_units ?? 0;
}

export async function getMyLuxyGiftWallet(client: Client): Promise<LuxyGiftWallet> {
  const { data, error } = await client.rpc('get_my_luxy_gift_wallet' as never);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return luxyGiftWalletSchema.parse(row);
}

export async function listMyLuxyGifts(
  client: Client,
  direction: LuxyGiftHistoryDirection,
  input: { limit?: number; offset?: number } = {},
): Promise<LuxyGiftHistoryItem[]> {
  const parsedDirection = luxyGiftHistoryDirectionSchema.parse(direction);
  const limit = z.number().int().min(1).max(50).parse(input.limit ?? 30);
  const offset = z.number().int().nonnegative().max(500).parse(input.offset ?? 0);
  const { data, error } = await client.rpc('list_my_luxy_gifts' as never, {
    p_direction: parsedDirection,
    p_limit: limit,
    p_offset: offset,
  } as never);
  if (error) throw error;
  return z.array(luxyGiftHistoryItemSchema).parse(data ?? []);
}

/**
 * OPT-09 realtime invalidation channel for the signed-in member's gift history.
 *
 * `gift_transactions.creator_id` is the stable legacy ledger column for the recipient.
 * It is intentionally not renamed during the optimization roadmap because the financial
 * schema is already in production. RLS limits rows to sender/recipient and both filtered
 * subscriptions keep the client from listening to unrelated gift traffic.
 */
export function subscribeToMyLuxyGiftTransactions(
  client: Client,
  input: { userId: string; onChange: () => void },
): RealtimeChannel {
  const userId = z.string().uuid().parse(input.userId);
  return client
    .channel(`luxy-gifts:${userId}:${createGiftIdempotencyKey()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'gift_transactions', filter: `sender_id=eq.${userId}` },
      input.onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'gift_transactions', filter: `creator_id=eq.${userId}` },
      input.onChange,
    )
    .subscribe();
}

export async function unsubscribeFromLuxyGiftTransactions(
  client: Client,
  channel: RealtimeChannel,
): Promise<void> {
  await client.removeChannel(channel);
}

export async function sendGiftToMember(
  client: Client,
  input: {
    recipientId: string;
    giftId: string;
    quantity?: number;
    idempotencyKey: string;
    conversationId?: string | null;
    clientMessageId?: string | null;
  },
): Promise<LuxyGiftSendResult> {
  const quantity = z.number().int().min(1).max(100).parse(input.quantity ?? 1);
  const recipientId = z.string().uuid().parse(input.recipientId);
  const giftId = z.string().uuid().parse(input.giftId);
  const idempotencyKey = z.string().uuid().parse(input.idempotencyKey);
  const conversationId = input.conversationId ? z.string().uuid().parse(input.conversationId) : null;
  const clientMessageId = input.clientMessageId ? z.string().uuid().parse(input.clientMessageId) : null;
  if ((conversationId === null) !== (clientMessageId === null)) {
    throw new Error('gift_conversation_message_pair_required');
  }

  const { data, error } = await client.rpc('send_luxy_gift' as never, {
    p_recipient_id: recipientId,
    p_gift_id: giftId,
    p_quantity: quantity,
    p_idempotency_key: idempotencyKey,
    p_conversation_id: conversationId,
    p_client_message_id: clientMessageId,
  } as never);
  if (error) throw error;
  const row = z.array(luxyGiftSendResultSchema).parse(data)[0];
  if (!row) throw new Error('gift_transaction_missing');
  return row;
}

// Backwards-compatible client alias for old Activity code. The transaction now uses Luxy member
// recipient semantics and intentionally does not create or progress legacy Fan relationships.
export async function sendGiftToCreator(
  client: Client,
  input: { creatorId: string; giftId: string; quantity?: number; idempotencyKey: string },
): Promise<GiftSendResult> {
  const result = await sendGiftToMember(client, {
    recipientId: input.creatorId,
    giftId: input.giftId,
    idempotencyKey: input.idempotencyKey,
    ...(input.quantity === undefined ? {} : { quantity: input.quantity }),
  });
  return {
    ...result,
    creator_id: result.recipient_id,
    creator_reward_units: result.recipient_reward_units,
    fan_eligible_units: 0,
    fan_threshold_units: 1,
    fan_status: 'none',
  };
}

export function getReadableGiftError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('premium_membership_required_for_gifting')) return 'Cần gói Cao cấp hoặc Kim cương để tặng quà.';
  if (message.includes('insufficient_heart_balance')) return 'Số dư ❤️ chưa đủ cho món quà này.';
  if (message.includes('gift_recipient_not_available')) return 'Thành viên này hiện không thể nhận quà.';
  if (message.includes('gifting_blocked')) return 'Không thể tặng quà cho tài khoản này.';
  if (message.includes('gift_not_active')) return 'Món quà này hiện không còn khả dụng.';
  if (message.includes('daily_gift_limit_exceeded')) return 'Giao dịch vượt giới hạn an toàn đang áp dụng.';
  if (message.includes('recipient_reward_account_frozen')) return 'Tài khoản nhận quà đang tạm khóa giao dịch.';
  if (message.includes('luxy_direct_conversation_required')) return 'Không thể gắn quà vào cuộc trò chuyện này.';
  return 'Không thể gửi quà lúc này. Vui lòng thử lại.';
}
