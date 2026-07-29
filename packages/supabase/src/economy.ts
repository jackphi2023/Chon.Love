import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from './database.types';
import type { RealtimeRowChange } from './social';

export type HeartProduct = Tables<'heart_products'>;
export type GiftCatalogItem = Tables<'gift_catalog'>;
export type GiftTransaction = Tables<'gift_transactions'>;
export type FanProgress = Tables<'fan_progress'>;
export type FanMembership = Tables<'fan_memberships'>;
export type EconomySync = Tables<'economy_sync'>;
export type EconomySummary = Database['public']['Functions']['get_my_economy_summary']['Returns'][number];
export type PlayPurchaseSummary = Database['public']['Functions']['list_my_play_purchases']['Returns'][number];
export type SendGiftResult = Database['public']['Functions']['send_gift']['Returns'][number];

export type EconomyPageInput = {
  limit?: number;
  cursor?: string | null;
};

export type SendGiftInput = {
  creatorId: string;
  giftId: string;
  quantity?: number;
  requestId: string;
  conversationId?: string | null;
  clientMessageId?: string | null;
};

export type VerifyGooglePlayPurchaseInput = {
  purchaseToken: string;
  googleProductId: string;
  requestId?: string;
};

export type VerifyGooglePlayPurchaseResult = {
  purchaseId: string;
  heartUnits: number;
  balanceAfterUnits: number;
  purchaseState: 'consumed';
  alreadyRecorded: boolean;
  requestId: string;
};

function firstOrThrow<T>(rows: T[] | null, operation: string): T {
  const row = rows?.[0];
  if (!row) throw new Error(`${operation} returned no row.`);
  return row;
}

function boundedPageSize(limit = 50): number {
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

export function assertSafeHeartUnits(units: number): number {
  if (!Number.isSafeInteger(units)) throw new Error('Heart units must be a safe integer.');
  return units;
}

export function heartUnitsToHearts(units: number): number {
  return assertSafeHeartUnits(units) / 100;
}

export function formatHeartUnits(units: number, locale = 'vi-VN'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(heartUnitsToHearts(units));
}

export async function listHeartProducts(client: SupabaseClient<Database>): Promise<HeartProduct[]> {
  const { data, error } = await client
    .from('heart_products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('id');
  if (error) throw error;
  return data ?? [];
}

export async function listGiftCatalog(client: SupabaseClient<Database>): Promise<GiftCatalogItem[]> {
  const { data, error } = await client
    .from('gift_catalog')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order')
    .order('id');
  if (error) throw error;
  return data ?? [];
}

export async function getMyEconomySummary(client: SupabaseClient<Database>): Promise<EconomySummary> {
  const { data, error } = await client.rpc('get_my_economy_summary');
  if (error) throw error;
  return firstOrThrow(data, 'get_my_economy_summary');
}

export async function listMyPlayPurchases(
  client: SupabaseClient<Database>,
  input: EconomyPageInput = {},
): Promise<PlayPurchaseSummary[]> {
  const { data, error } = await client.rpc('list_my_play_purchases', {
    p_limit: boundedPageSize(input.limit),
    ...(input.cursor == null ? {} : { p_cursor: input.cursor }),
  });
  if (error) throw error;
  return data ?? [];
}

export async function listMyGifts(
  client: SupabaseClient<Database>,
  input: EconomyPageInput = {},
): Promise<GiftTransaction[]> {
  const { data, error } = await client.rpc('list_my_gifts', {
    p_limit: boundedPageSize(input.limit),
    ...(input.cursor == null ? {} : { p_cursor: input.cursor }),
  });
  if (error) throw error;
  return data ?? [];
}

export async function sendGift(client: SupabaseClient<Database>, input: SendGiftInput): Promise<SendGiftResult> {
  const hasConversation = input.conversationId != null;
  const hasClientMessage = input.clientMessageId != null;
  if (hasConversation !== hasClientMessage) {
    throw new Error('conversationId and clientMessageId must be provided together.');
  }
  const quantity = Math.trunc(input.quantity ?? 1);
  if (quantity < 1 || quantity > 100) throw new Error('Gift quantity must be between 1 and 100.');
  const { data, error } = await client.rpc('send_gift', {
    p_creator_id: input.creatorId,
    p_gift_id: input.giftId,
    p_quantity: quantity,
    p_idempotency_key: input.requestId,
    ...(input.conversationId == null ? {} : { p_conversation_id: input.conversationId }),
    ...(input.clientMessageId == null ? {} : { p_client_message_id: input.clientMessageId }),
  });
  if (error) throw error;
  return firstOrThrow(data, 'send_gift');
}

export async function verifyGooglePlayPurchase(
  client: SupabaseClient<Database>,
  input: VerifyGooglePlayPurchaseInput,
): Promise<VerifyGooglePlayPurchaseResult> {
  const purchaseToken = input.purchaseToken.trim();
  if (!purchaseToken) throw new Error('Google Play purchase token is required.');
  const { data, error } = await client.functions.invoke<VerifyGooglePlayPurchaseResult>('play-purchase-verify', {
    body: {
      purchaseToken,
      googleProductId: input.googleProductId,
      ...(input.requestId ? { requestId: input.requestId } : {}),
    },
  });
  if (error) throw error;
  if (!data?.purchaseId) throw new Error('play-purchase-verify returned no purchase result.');
  return data;
}

export async function listFanProgress(client: SupabaseClient<Database>): Promise<FanProgress[]> {
  const { data, error } = await client.from('fan_progress').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listFanMemberships(client: SupabaseClient<Database>): Promise<FanMembership[]> {
  const { data, error } = await client.from('fan_memberships').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function subscribeToEconomySync(
  client: SupabaseClient<Database>,
  userId: string,
  onChange: (change: RealtimeRowChange<EconomySync>) => void,
): RealtimeChannel {
  return client
    .channel(`economy:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'economy_sync', filter: `user_id=eq.${userId}` },
      (payload) => onChange(payload as unknown as RealtimeRowChange<EconomySync>),
    )
    .subscribe();
}

export function subscribeToMyGiftTransactions(
  client: SupabaseClient<Database>,
  userId: string,
  onChange: (change: RealtimeRowChange<GiftTransaction>) => void,
): RealtimeChannel {
  return client
    .channel(`economy:${userId}:gifts`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'gift_transactions', filter: `sender_id=eq.${userId}` },
      (payload) => onChange(payload as unknown as RealtimeRowChange<GiftTransaction>),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'gift_transactions', filter: `creator_id=eq.${userId}` },
      (payload) => onChange(payload as unknown as RealtimeRowChange<GiftTransaction>),
    )
    .subscribe();
}

export function subscribeToMyFanState(
  client: SupabaseClient<Database>,
  userId: string,
  onProgressChange: (change: RealtimeRowChange<FanProgress>) => void,
  onMembershipChange: (change: RealtimeRowChange<FanMembership>) => void,
): RealtimeChannel {
  return client
    .channel(`economy:${userId}:fan-state`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'fan_progress', filter: `fan_user_id=eq.${userId}` },
      (payload) => onProgressChange(payload as unknown as RealtimeRowChange<FanProgress>),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'fan_progress', filter: `creator_id=eq.${userId}` },
      (payload) => onProgressChange(payload as unknown as RealtimeRowChange<FanProgress>),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'fan_memberships', filter: `fan_user_id=eq.${userId}` },
      (payload) => onMembershipChange(payload as unknown as RealtimeRowChange<FanMembership>),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'fan_memberships', filter: `creator_id=eq.${userId}` },
      (payload) => onMembershipChange(payload as unknown as RealtimeRowChange<FanMembership>),
    )
    .subscribe();
}
