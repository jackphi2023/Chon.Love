import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

// LX-16 mailbox is a presentation/read-model layer over the LX-15 direct messaging contract.
// The server remains authoritative for who may create/send/read conversations.
type Client = SupabaseClient<Database>;

export const LUXY_MAILBOX_PAGE_SIZE = 30;

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
  friendship_status: z.enum(['direct', 'pending', 'accepted', 'declined', 'cancelled']),
  can_send: z.boolean(),
  blocked: z.boolean(),
  is_archived: z.boolean(),
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

export async function getLuxyProfileConversation(
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

export function formatLuxyMailboxPreview(conversation: LuxyMailboxConversation): string {
  if (!conversation.last_message_id) return conversation.can_send ? 'Bắt đầu trò chuyện' : 'Chưa có tin nhắn';
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
