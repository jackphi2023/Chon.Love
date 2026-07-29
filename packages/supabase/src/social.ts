import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Database, Enums, Json, Tables } from './database.types';

export type LocationSource = 'device_foreground' | 'device_approximate';
export type DistanceBucket = 'under_1km' | '1_to_3km' | '3_to_5km' | '5_to_8km' | '8_to_15km' | 'over_15km';
export type NearbyProfile = Database['public']['Functions']['find_nearby_profiles']['Returns'][number];
export type ReportSummary = Database['public']['Functions']['get_my_reports']['Returns'][number];
export type Friendship = Tables<'friendships'>;
export type Conversation = Tables<'conversations'>;
export type ConversationMember = Tables<'conversation_members'>;
export type Message = Tables<'messages'>;

export type SetMyLocationInput = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
  source?: LocationSource;
};

export type DiscoveryPageInput = {
  limit?: number;
  cursor?: string | null;
};

export type NearbyPageInput = DiscoveryPageInput & {
  radiusMeters?: number;
};

export type CreateReportInput = {
  targetUserId?: string | null;
  targetMediaId?: string | null;
  targetMessageId?: string | null;
  reasonCode: string;
  description?: string | null;
  evidence?: Json;
};

export type RealtimeRowChange<T> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
  commitTimestamp?: string;
  new: T | Record<string, never>;
  old: Partial<T>;
};

function firstOrThrow<T>(rows: T[] | null, operation: string): T {
  const row = rows?.[0];
  if (!row) throw new Error(`${operation} returned no row.`);
  return row;
}

export async function setMyLocation(client: SupabaseClient<Database>, input: SetMyLocationInput) {
  const { data, error } = await client.rpc('set_my_location', {
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_accuracy_meters: input.accuracyMeters,
    p_captured_at: input.capturedAt,
    ...(input.source ? { p_source: input.source } : {}),
  });
  if (error) throw error;
  return firstOrThrow(data, 'set_my_location');
}

export async function disableMyLocation(client: SupabaseClient<Database>): Promise<boolean> {
  const { data, error } = await client.rpc('disable_my_location');
  if (error) throw error;
  return data;
}

export async function findNearbyProfiles(client: SupabaseClient<Database>, input: NearbyPageInput = {}): Promise<NearbyProfile[]> {
  const { data, error } = await client.rpc('find_nearby_profiles', {
    ...(input.radiusMeters == null ? {} : { p_radius_meters: input.radiusMeters }),
    ...(input.limit == null ? {} : { p_limit: input.limit }),
    ...(input.cursor == null ? {} : { p_cursor: input.cursor }),
  });
  if (error) throw error;
  return data ?? [];
}

export async function findProvinceProfiles(client: SupabaseClient<Database>, provinceId: number, input: DiscoveryPageInput = {}): Promise<Tables<'profiles'>[]> {
  const { data, error } = await client.rpc('find_province_profiles', {
    p_province_id: provinceId,
    ...(input.limit == null ? {} : { p_limit: input.limit }),
    ...(input.cursor == null ? {} : { p_cursor: input.cursor }),
  });
  if (error) throw error;
  return data ?? [];
}

export async function sendFriendRequest(client: SupabaseClient<Database>, addresseeId: string, greetingMessage?: string | null): Promise<Friendship> {
  const { data, error } = await client.rpc('send_friend_request', {
    p_addressee_id: addresseeId,
    ...(greetingMessage == null ? {} : { p_greeting_message: greetingMessage }),
  });
  if (error) throw error;
  return data;
}

export async function respondToFriendRequest(client: SupabaseClient<Database>, friendshipId: string, accept: boolean): Promise<Friendship> {
  const { data, error } = await client.rpc('respond_to_friend_request', { p_friendship_id: friendshipId, p_accept: accept });
  if (error) throw error;
  return data;
}

export async function cancelFriendRequest(client: SupabaseClient<Database>, friendshipId: string): Promise<boolean> {
  const { data, error } = await client.rpc('cancel_friend_request', { p_friendship_id: friendshipId });
  if (error) throw error;
  return data;
}

export async function blockUser(client: SupabaseClient<Database>, blockedId: string, reasonCode?: string | null): Promise<boolean> {
  const { data, error } = await client.rpc('block_user', {
    p_blocked_id: blockedId,
    ...(reasonCode == null ? {} : { p_reason_code: reasonCode }),
  });
  if (error) throw error;
  return data;
}

export async function unblockUser(client: SupabaseClient<Database>, blockedId: string): Promise<boolean> {
  const { data, error } = await client.rpc('unblock_user', { p_blocked_id: blockedId });
  if (error) throw error;
  return data;
}

export async function createReport(client: SupabaseClient<Database>, input: CreateReportInput): Promise<string> {
  const { data, error } = await client.rpc('create_report', {
    p_reason_code: input.reasonCode,
    ...(input.targetUserId == null ? {} : { p_target_user_id: input.targetUserId }),
    ...(input.targetMediaId == null ? {} : { p_target_media_id: input.targetMediaId }),
    ...(input.targetMessageId == null ? {} : { p_target_message_id: input.targetMessageId }),
    ...(input.description == null ? {} : { p_description: input.description }),
    ...(input.evidence == null ? {} : { p_evidence_json: input.evidence }),
  });
  if (error) throw error;
  return data;
}

export async function getMyReports(client: SupabaseClient<Database>, input: DiscoveryPageInput = {}): Promise<ReportSummary[]> {
  const { data, error } = await client.rpc('get_my_reports', {
    ...(input.limit == null ? {} : { p_limit: input.limit }),
    ...(input.cursor == null ? {} : { p_cursor: input.cursor }),
  });
  if (error) throw error;
  return data ?? [];
}

export async function listMyFriendships(client: SupabaseClient<Database>, status?: Enums<'friendship_status'>): Promise<Friendship[]> {
  let query = client.from('friendships').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listMyConversations(client: SupabaseClient<Database>): Promise<Conversation[]> {
  const { data, error } = await client.from('conversations').select('*').order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function listConversationMessages(client: SupabaseClient<Database>, conversationId: string, limit = 50): Promise<Message[]> {
  const { data, error } = await client.from('messages').select('*').eq('conversation_id', conversationId).order('sent_at', { ascending: false }).limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(client: SupabaseClient<Database>, conversationId: string, body: string, clientMessageId: string): Promise<Message> {
  const { data, error } = await client.rpc('send_message', {
    p_conversation_id: conversationId,
    p_body: body,
    p_client_message_id: clientMessageId,
  });
  if (error) throw error;
  return data;
}

export async function markConversationRead(client: SupabaseClient<Database>, conversationId: string, messageId?: string | null): Promise<boolean> {
  const { data, error } = await client.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
    ...(messageId == null ? {} : { p_message_id: messageId }),
  });
  if (error) throw error;
  return data;
}

export function subscribeToConversationMessages(client: SupabaseClient<Database>, conversationId: string, onChange: (change: RealtimeRowChange<Message>) => void): RealtimeChannel {
  return client
    .channel(`conversation:${conversationId}:messages`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => onChange(payload as unknown as RealtimeRowChange<Message>))
    .subscribe();
}

export function subscribeToFriendships(client: SupabaseClient<Database>, onChange: (change: RealtimeRowChange<Friendship>) => void): RealtimeChannel {
  return client
    .channel('my:friendships')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, (payload) => onChange(payload as unknown as RealtimeRowChange<Friendship>))
    .subscribe();
}

export function subscribeToConversationMemberships(client: SupabaseClient<Database>, onChange: (change: RealtimeRowChange<ConversationMember>) => void): RealtimeChannel {
  return client
    .channel('my:conversation-memberships')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, (payload) => onChange(payload as unknown as RealtimeRowChange<ConversationMember>))
    .subscribe();
}
