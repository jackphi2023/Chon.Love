import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { CHAT_RETENTION_DELETED_PLACEHOLDER, createChatClientMessageId } from './chat';
import type { Database } from './database.types';

// LX-16 mailbox is a presentation/read-model layer over the LX-15 direct messaging contract.
// LX-17 adds paid-tier presentation metadata only; the server remains authoritative for entitlements.
// OPT-10 adds one viewer-scoped realtime channel so mailbox previews/unread state stay live without polling.
type Client = SupabaseClient<Database>;

export const LUXY_MAILBOX_PAGE_SIZE = 30;

export type LuxyMailboxRealtimeSource = 'message' | 'member' | 'conversation';
export type LuxyMailboxRealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed';

const mailboxConversationSchema = z.object({
  conversation_id: z.string().uuid(),
  friendship_id: z.string().uuid().nullable(),
  other_user_id: z.string().uuid(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  age: z.coerce.number().int().min(18).max(120),
  headline: z.string().nullable(),
  province_name: z.string().nullable(),
  avatar_media_id: z.string().uuid().nullable(),
  avatar_storage_bucket: z.string().nullable(),
  avatar_storage_path: z.string().nullable(),
  is_creator: z.boolean(),
  is_online: z.boolean(),
  membership_tier: z.enum(['free', 'premium', 'diamond']),
  friendship_status: z.enum(['direct', 'pending', 'accepted', 'declined', 'cancelled']),
  can_send: z.boolean(),
  blocked: z.boolean(),
  is_archived: z.boolean(),
  retention_purged_at: z.string().nullable().optional(),
  last_message_id: z.string().uuid().nullable(),
  last_message_type: z.enum(['text', 'gift', 'system']).nullable(),
  last_message_body: z.string().nullable(),
  last_message_sender_id: z.string().uuid().nullable(),
  last_message_sent_at: z.string().nullable(),
  unread_count: z.coerce.number().int().nonnegative(),
});

export type LuxyMailboxConversation = z.infer<typeof mailboxConversationSchema>;

export async function listLuxyMailbox(
  client: Client,
  options: { limit?: number; offset?: number } = {},
): Promise<LuxyMailboxConversation[]> {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? LUXY_MAILBOX_PAGE_SIZE), 1), 50);
  const offset = Math.min(Math.max(Math.trunc(options.offset ?? 0), 0), 500);
  const { data, error } = await client.rpc(
    'list_my_conversations' as never,
    { p_limit: limit, p_offset: offset } as never,
  );
  if (error) throw error;
  return z.array(mailboxConversationSchema).parse(data ?? []);
}

export async function setConversationArchived(
  client: Client,
  conversationId: string,
  archived: boolean,
): Promise<void> {
  const { data, error } = await client.rpc(
    'set_conversation_archived' as never,
    { p_conversation_id: z.string().uuid().parse(conversationId), p_archived: archived } as never,
  );
  if (error) throw error;
  if (data !== true) throw new Error('conversation_not_available');
}

export async function openLuxyProfileConversation(
  client: Client,
  profileId: string,
): Promise<string> {
  const { data, error } = await client.rpc(
    'get_luxy_profile_conversation' as never,
    { p_profile_id: z.string().uuid().parse(profileId) } as never,
  );
  if (error) throw error;
  return z.string().uuid().parse(data);
}

export function subscribeToLuxyMailboxRealtime(
  client: Client,
  input: {
    userId: string;
    onChange: (source: LuxyMailboxRealtimeSource) => void;
    onStatus?: (status: LuxyMailboxRealtimeStatus) => void;
  },
): RealtimeChannel {
  const userId = z.string().uuid().parse(input.userId);
  input.onStatus?.('connecting');

  const channel = client
    .channel(`mailbox:${userId}:${createChatClientMessageId()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      () => input.onChange('message'),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages' },
      () => input.onChange('message'),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_members',
        filter: `user_id=eq.${userId}`,
      },
      () => input.onChange('member'),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'conversations' },
      () => input.onChange('conversation'),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') input.onStatus?.('connected');
      else if (status === 'TIMED_OUT') input.onStatus?.('reconnecting');
      else if (status === 'CHANNEL_ERROR') input.onStatus?.('error');
      else if (status === 'CLOSED') input.onStatus?.('closed');
    });

  return channel;
}

export async function unsubscribeFromLuxyMailboxRealtime(
  client: Client,
  channel: RealtimeChannel,
): Promise<void> {
  await client.removeChannel(channel);
}

export function formatLuxyMailboxPreview(conversation: LuxyMailboxConversation): string {
  if (!conversation.last_message_id) {
    if (conversation.retention_purged_at) return CHAT_RETENTION_DELETED_PLACEHOLDER;
    return conversation.can_send ? 'Bắt đầu trò chuyện' : 'Chưa có tin nhắn';
  }
  if (conversation.last_message_type === 'gift') return 'Đã gửi một món quà';
  if (conversation.last_message_type === 'system') return 'Thông báo hệ thống';
  return conversation.last_message_body?.trim() || 'Tin nhắn không còn hiển thị';
}

export function getReadableLuxyMailboxError(error: unknown): string {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : String(error ?? '');
  if (message.includes('premium_membership_required')) return 'Nâng cấp Premium hoặc Diamond để gửi tin nhắn.';
  if (message.includes('messaging_blocked')) return 'Cuộc trò chuyện đã bị khóa do chặn.';
  if (message.includes('conversation_target_not_available') || message.includes('recipient_not_available')) {
    return 'Thành viên này hiện không thể nhận tin nhắn.';
  }
  if (message.includes('conversation_not_available')) return 'Cuộc trò chuyện không còn khả dụng.';
  return 'Không thể cập nhật Tin nhắn. Vui lòng thử lại.';
}
