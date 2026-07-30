import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

type Client = SupabaseClient<Database>;

export const CHAT_DEFAULT_PAGE_SIZE = 40;
export const CHAT_MAX_PAGE_SIZE = 50;
export const CHAT_MESSAGE_MAX_CHARACTERS = 2_000;
export const CHAT_CONVERSATION_PAGE_SIZE = 30;
export const CHAT_AUTO_DELETE_DAYS = 7;
export const CHAT_AUTO_DELETE_MS = CHAT_AUTO_DELETE_DAYS * 24 * 60 * 60 * 1_000;

const friendshipStatusSchema = z.enum(['pending', 'accepted', 'declined', 'cancelled']);
const messageTypeSchema = z.enum(['text', 'gift', 'system']);

const conversationSummarySchema = z.object({
  conversation_id: z.string().uuid(),
  friendship_id: z.string().uuid(),
  other_user_id: z.string().uuid(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  province_name: z.string().nullable(),
  avatar_media_id: z.string().uuid().nullable(),
  avatar_storage_bucket: z.string().nullable(),
  avatar_storage_path: z.string().nullable(),
  is_creator: z.boolean(),
  friendship_status: friendshipStatusSchema,
  can_send: z.boolean(),
  blocked: z.boolean(),
  last_message_id: z.string().uuid().nullable(),
  last_message_type: messageTypeSchema.nullable(),
  last_message_body: z.string().nullable(),
  last_message_sender_id: z.string().uuid().nullable(),
  last_message_sent_at: z.string().nullable(),
  unread_count: z.coerce.number().int().nonnegative(),
});

const conversationDetailSchema = z.object({
  conversation_id: z.string().uuid(),
  friendship_id: z.string().uuid(),
  friendship_status: friendshipStatusSchema,
  other_user_id: z.string().uuid(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  province_name: z.string().nullable(),
  avatar_media_id: z.string().uuid().nullable(),
  avatar_storage_bucket: z.string().nullable(),
  avatar_storage_path: z.string().nullable(),
  is_creator: z.boolean(),
  blocked_by_viewer: z.boolean(),
  blocked_by_other: z.boolean(),
  can_send: z.boolean(),
  message_max_characters: z.coerce.number().int().positive().max(CHAT_MESSAGE_MAX_CHARACTERS),
  page_size: z.coerce.number().int().positive().max(CHAT_MAX_PAGE_SIZE),
  last_read_message_id: z.string().uuid().nullable(),
  last_read_at: z.string().nullable(),
});

const conversationRetentionSchema = z.object({
  conversation_id: z.string().uuid(),
  auto_delete_enabled: z.boolean(),
  auto_delete_after_days: z.literal(CHAT_AUTO_DELETE_DAYS).nullable(),
  updated_at: z.string().nullable(),
});

const conversationRetentionUpdateSchema = conversationRetentionSchema.extend({
  deleted_messages: z.coerce.number().int().nonnegative(),
});

const chatMessageSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  message_type: messageTypeSchema,
  body: z.string().nullable(),
  gift_transaction_id: z.string().uuid().nullable(),
  client_message_id: z.string().uuid(),
  sent_at: z.string(),
  edited_at: z.string().nullable(),
  removed: z.boolean(),
  is_own: z.boolean(),
  is_read_by_other: z.boolean(),
});

const sentMessageRowSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  message_type: messageTypeSchema,
  body: z.string().nullable(),
  gift_transaction_id: z.string().uuid().nullable(),
  client_message_id: z.string().uuid(),
  moderation_status: z.enum(['unreviewed', 'approved', 'flagged', 'removed']),
  sent_at: z.string(),
  edited_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});

const deletedMessageRowSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
});

const realtimeConversationSchema = z.object({
  id: z.string().uuid(),
  auto_delete_messages_after_days: z.union([z.literal(CHAT_AUTO_DELETE_DAYS), z.null()]),
  message_retention_updated_at: z.string().nullable(),
});

export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;
export type ConversationRetention = z.infer<typeof conversationRetentionSchema>;
export type ConversationRetentionUpdate = z.infer<typeof conversationRetentionUpdateSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatMessageCursor = { sentAt: string; id: string };
export type ChatRealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed';

export async function listMyConversations(
  client: Client,
  limit = CHAT_CONVERSATION_PAGE_SIZE,
  offset = 0,
): Promise<ConversationSummary[]> {
  const { data, error } = await client.rpc(
    'list_my_conversations' as never,
    { p_limit: limit, p_offset: offset } as never,
  );
  if (error) throw error;
  return z.array(conversationSummarySchema).parse(data);
}

export async function getDirectConversation(client: Client, otherUserId: string): Promise<string | null> {
  const { data, error } = await client.rpc(
    'get_direct_conversation' as never,
    { p_other_user_id: otherUserId } as never,
  );
  if (error) throw error;
  return z.string().uuid().nullable().parse(data);
}

export async function getConversationDetail(client: Client, conversationId: string): Promise<ConversationDetail> {
  const { data, error } = await client.rpc(
    'get_conversation_detail' as never,
    { p_conversation_id: conversationId } as never,
  );
  if (error) throw error;
  const row = z.array(conversationDetailSchema).parse(data)[0];
  if (!row) throw new Error('conversation_not_available');
  return row;
}

export async function getConversationRetention(
  client: Client,
  conversationId: string,
): Promise<ConversationRetention> {
  const { data, error } = await client.rpc(
    'get_conversation_retention' as never,
    { p_conversation_id: conversationId } as never,
  );
  if (error) throw error;
  const row = z.array(conversationRetentionSchema).parse(data)[0];
  if (!row) throw new Error('conversation_not_available');
  return row;
}

export async function setConversationAutoDelete(
  client: Client,
  conversationId: string,
  enabled: boolean,
): Promise<ConversationRetentionUpdate> {
  const { data, error } = await client.rpc(
    'set_conversation_auto_delete' as never,
    { p_conversation_id: conversationId, p_enabled: enabled } as never,
  );
  if (error) throw error;
  const row = z.array(conversationRetentionUpdateSchema).parse(data)[0];
  if (!row) throw new Error('conversation_not_available');
  return row;
}

export async function listConversationMessages(
  client: Client,
  input: {
    conversationId: string;
    limit?: number;
    before?: ChatMessageCursor | null;
  },
): Promise<ChatMessage[]> {
  const { data, error } = await client.rpc(
    'list_conversation_messages' as never,
    {
      p_conversation_id: input.conversationId,
      p_limit: input.limit ?? CHAT_DEFAULT_PAGE_SIZE,
      p_before_sent_at: input.before?.sentAt ?? null,
      p_before_id: input.before?.id ?? null,
    } as never,
  );
  if (error) throw error;
  return z.array(chatMessageSchema).parse(data);
}

export async function sendChatMessage(
  client: Client,
  input: { conversationId: string; body: string; clientMessageId: string },
): Promise<ChatMessage> {
  const body = input.body.trim();
  if (!body || body.length > CHAT_MESSAGE_MAX_CHARACTERS) throw new Error('invalid_message_body');
  const { data, error } = await client.rpc(
    'send_message' as never,
    {
      p_conversation_id: input.conversationId,
      p_body: body,
      p_client_message_id: input.clientMessageId,
    } as never,
  );
  if (error) throw error;
  const row = sentMessageRowSchema.parse(data);
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    message_type: row.message_type,
    body: row.deleted_at || row.moderation_status === 'removed' ? null : row.body,
    gift_transaction_id: row.gift_transaction_id,
    client_message_id: row.client_message_id,
    sent_at: row.sent_at,
    edited_at: row.edited_at,
    removed: Boolean(row.deleted_at || row.moderation_status === 'removed'),
    is_own: true,
    is_read_by_other: false,
  };
}

export async function markConversationRead(
  client: Client,
  conversationId: string,
  messageId?: string | null,
): Promise<void> {
  const { data, error } = await client.rpc(
    'mark_conversation_read' as never,
    { p_conversation_id: conversationId, p_message_id: messageId ?? null } as never,
  );
  if (error) throw error;
  if (!data) throw new Error('conversation_not_available');
}

export async function hideMessageForMe(client: Client, messageId: string): Promise<void> {
  const { data, error } = await client.rpc(
    'hide_message_for_me' as never,
    { p_message_id: messageId } as never,
  );
  if (error) throw error;
  if (!data) throw new Error('message_not_available');
}

export function getOlderMessageCursor(
  page: readonly ChatMessage[],
  pageSize = CHAT_DEFAULT_PAGE_SIZE,
): ChatMessageCursor | undefined {
  if (page.length < pageSize) return undefined;
  const oldest = page.at(-1);
  return oldest ? { sentAt: oldest.sent_at, id: oldest.id } : undefined;
}

export function mergeChatMessagesNewestFirst(
  messages: readonly ChatMessage[],
): ChatMessage[] {
  const byIdentity = new Map<string, ChatMessage>();
  for (const message of messages) {
    const key = `${message.sender_id}:${message.client_message_id}`;
    const existing = byIdentity.get(key);
    if (!existing || existing.sent_at <= message.sent_at) byIdentity.set(key, message);
  }
  return [...byIdentity.values()].sort((a, b) => {
    const sentComparison = b.sent_at.localeCompare(a.sent_at);
    return sentComparison || b.id.localeCompare(a.id);
  });
}

export function filterExpiredChatMessages(
  messages: readonly ChatMessage[],
  retention: ConversationRetention | null | undefined,
  nowMs = Date.now(),
): ChatMessage[] {
  if (!retention?.auto_delete_enabled) return [...messages];
  const cutoff = nowMs - CHAT_AUTO_DELETE_MS;
  return messages.filter((message) => new Date(message.sent_at).getTime() > cutoff);
}

export function getNextChatExpiryMs(
  messages: readonly ChatMessage[],
  retention: ConversationRetention | null | undefined,
  nowMs = Date.now(),
): number | null {
  if (!retention?.auto_delete_enabled) return null;
  let next: number | null = null;
  for (const message of messages) {
    const expiry = new Date(message.sent_at).getTime() + CHAT_AUTO_DELETE_MS;
    if (expiry <= nowMs) continue;
    if (next === null || expiry < next) next = expiry;
  }
  return next;
}

export function formatConversationPreview(conversation: ConversationSummary): string {
  if (!conversation.last_message_id) return conversation.can_send ? 'Bắt đầu trò chuyện' : 'Chưa có tin nhắn';
  if (conversation.last_message_type === 'gift') return 'Đã gửi một món quà';
  if (conversation.last_message_type === 'system') return 'Thông báo hệ thống';
  return conversation.last_message_body?.trim() || 'Tin nhắn không còn hiển thị';
}

export function createChatClientMessageId(): string {
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

export function subscribeToConversationMessages(
  client: Client,
  input: {
    conversationId: string;
    viewerUserId: string;
    onMessage: (message: ChatMessage) => void;
    onDelete?: (messageId: string) => void;
    onRetentionChange?: (retention: ConversationRetention) => void;
    onStatus: (status: ChatRealtimeStatus) => void;
  },
): RealtimeChannel {
  input.onStatus('connecting');
  const channel = client
    .channel(`chat:${input.conversationId}:${createChatClientMessageId()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${input.conversationId}`,
      },
      (payload) => {
        const parsed = sentMessageRowSchema.safeParse(payload.new);
        if (!parsed.success) return;
        const row = parsed.data;
        input.onMessage({
          id: row.id,
          conversation_id: row.conversation_id,
          sender_id: row.sender_id,
          message_type: row.message_type,
          body: row.deleted_at || row.moderation_status === 'removed' ? null : row.body,
          gift_transaction_id: row.gift_transaction_id,
          client_message_id: row.client_message_id,
          sent_at: row.sent_at,
          edited_at: row.edited_at,
          removed: Boolean(row.deleted_at || row.moderation_status === 'removed'),
          is_own: row.sender_id === input.viewerUserId,
          is_read_by_other: false,
        });
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${input.conversationId}`,
      },
      (payload) => {
        const parsed = deletedMessageRowSchema.safeParse(payload.old);
        if (parsed.success) input.onDelete?.(parsed.data.id);
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `id=eq.${input.conversationId}`,
      },
      (payload) => {
        const parsed = realtimeConversationSchema.safeParse(payload.new);
        if (!parsed.success) return;
        input.onRetentionChange?.({
          conversation_id: parsed.data.id,
          auto_delete_enabled: parsed.data.auto_delete_messages_after_days === CHAT_AUTO_DELETE_DAYS,
          auto_delete_after_days: parsed.data.auto_delete_messages_after_days,
          updated_at: parsed.data.message_retention_updated_at,
        });
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') input.onStatus('connected');
      else if (status === 'TIMED_OUT') input.onStatus('reconnecting');
      else if (status === 'CHANNEL_ERROR') input.onStatus('error');
      else if (status === 'CLOSED') input.onStatus('closed');
    });
  return channel;
}

export async function unsubscribeFromConversation(client: Client, channel: RealtimeChannel): Promise<void> {
  await client.removeChannel(channel);
}

export function getReadableChatError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('accepted_friendship_required')) return 'Chat chỉ mở khi hai tài khoản vẫn là bạn bè.';
  if (message.includes('messaging_blocked')) return 'Không thể gửi tin vì một trong hai tài khoản đã chặn người kia.';
  if (message.includes('recipient_not_available')) return 'Người nhận hiện không thể nhận tin nhắn.';
  if (message.includes('message_rate_limited')) return 'Bạn đang gửi quá nhanh. Hãy đợi một lúc rồi thử lại.';
  if (message.includes('invalid_message_body')) return `Tin nhắn phải có nội dung và tối đa ${CHAT_MESSAGE_MAX_CHARACTERS.toLocaleString('vi-VN')} ký tự.`;
  if (message.includes('client_message_id_conflict')) return 'Không thể gửi lại tin nhắn vì mã chống trùng không khớp.';
  if (message.includes('auto_delete_setting_required')) return 'Không thể cập nhật chế độ tự động xóa.';
  if (message.includes('conversation_not_available') || message.includes('sender_not_conversation_member')) return 'Bạn không có quyền truy cập cuộc trò chuyện này.';
  if (message.includes('authentication_required')) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
  return 'Không thể hoàn tất thao tác chat. Hãy kiểm tra kết nối và thử lại.';
}
