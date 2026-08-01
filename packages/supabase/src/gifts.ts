import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

const HEART_UNITS_PER_HEART = 100;
export const SESSION_19_GIFT_COUNT = 20;

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

const giftSendResultSchema = z.object({
  gift_transaction_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  creator_id: z.string().uuid(),
  gift_id: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  gross_heart_units: z.coerce.number().int().positive(),
  creator_reward_units: z.coerce.number().int().nonnegative(),
  platform_gross_units: z.coerce.number().int().nonnegative(),
  sender_balance_units: z.coerce.number().int().nonnegative(),
  reward_available_at: z.string(),
  fan_eligible_units: z.coerce.number().int().nonnegative(),
  fan_threshold_units: z.coerce.number().int().positive(),
  fan_status: z.enum(['none', 'active']),
  message_id: z.string().uuid().nullable(),
  already_processed: z.boolean(),
});

export type GiftCatalogItem = z.infer<typeof giftCatalogItemSchema>;
export type GiftSendResult = z.infer<typeof giftSendResultSchema>;
export type GiftCatalogContractIssue = {
  code: 'count' | 'display_hearts' | 'heart_price_units' | 'sort_order' | 'duplicate';
  message: string;
};

type Client = SupabaseClient<Database>;

export const giftCatalogQueryKeys = {
  all: ['gift-catalog'] as const,
  active: ['gift-catalog', 'active'] as const,
  balance: (userId: string | null) => ['gift-catalog', 'balance', userId] as const,
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

export async function sendGiftToCreator(
  client: Client,
  input: { creatorId: string; giftId: string; quantity?: number; idempotencyKey: string },
): Promise<GiftSendResult> {
  const { data, error } = await client.rpc('send_gift' as never, {
    p_creator_id: input.creatorId,
    p_gift_id: input.giftId,
    p_quantity: input.quantity ?? 1,
    p_idempotency_key: input.idempotencyKey,
    p_conversation_id: null,
    p_client_message_id: null,
  } as never);
  if (error) throw error;
  const row = z.array(giftSendResultSchema).parse(data)[0];
  if (!row) throw new Error('gift_transaction_missing');
  return row;
}
