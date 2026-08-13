import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

const receivedGiftLogItemSchema = z.object({
  gift_transaction_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  sender_username: z.string().nullable(),
  sender_display_name: z.string().nullable(),
  gift_id: z.string().uuid(),
  gift_slug: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  gift_name_vi: z.string().trim().min(1).max(80),
  gift_name_en: z.string().trim().min(1).max(80),
  gift_icon_emoji: z.string().trim().min(1).max(16).nullable(),
  quantity: z.coerce.number().int().positive().max(100),
  unit_heart_units: z.coerce.number().int().positive(),
  gross_heart_units: z.coerce.number().int().positive(),
  recipient_reward_units: z.coerce.number().int().nonnegative(),
  platform_gross_units: z.coerce.number().int().nonnegative(),
  reversed_heart_units: z.coerce.number().int().nonnegative(),
  net_heart_units: z.coerce.number().int().nonnegative(),
  reward_available_at: z.string().nullable(),
  status: z.enum(['completed', 'partially_reversed', 'reversed']),
  message_id: z.string().uuid().nullable(),
  received_at: z.string(),
  completed_at: z.string(),
  reversed_at: z.string().nullable(),
});

export type LuxyReceivedGiftLogItem = z.infer<typeof receivedGiftLogItemSchema>;

type Client = SupabaseClient<Database>;

export const giftReceiptLogQueryKeys = {
  mine: (userId: string | null) => ['luxy-received-gift-log', userId] as const,
};

export async function listMyReceivedGiftLog(
  client: Client,
  input: { limit?: number; offset?: number } = {},
): Promise<LuxyReceivedGiftLogItem[]> {
  const limit = z.number().int().min(1).max(100).parse(input.limit ?? 50);
  const offset = z.number().int().nonnegative().max(5000).parse(input.offset ?? 0);
  const { data, error } = await client.rpc('list_my_received_gift_log' as never, {
    p_limit: limit,
    p_offset: offset,
  } as never);
  if (error) throw error;
  return z.array(receivedGiftLogItemSchema).parse(data ?? []);
}

export function formatGiftLogTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
