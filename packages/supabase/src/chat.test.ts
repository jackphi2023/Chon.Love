import { describe, expect, it } from 'vitest';
import {
  createChatClientMessageId,
  formatConversationPreview,
  getOlderMessageCursor,
  mergeChatMessagesNewestFirst,
  type ChatMessage,
  type ConversationSummary,
} from './chat';

const conversation: ConversationSummary = {
  conversation_id: '11111111-1111-4111-8111-111111111111',
  friendship_id: '22222222-2222-4222-8222-222222222222',
  other_user_id: '33333333-3333-4333-8333-333333333333',
  username: 'creator_a',
  display_name: 'Creator A',
  province_name: 'Thành phố Hồ Chí Minh',
  avatar_media_id: null,
  avatar_storage_bucket: null,
  avatar_storage_path: null,
  is_creator: true,
  friendship_status: 'accepted',
  can_send: true,
  blocked: false,
  last_message_id: null,
  last_message_type: null,
  last_message_body: null,
  last_message_sender_id: null,
  last_message_sent_at: null,
  unread_count: 0,
};

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    conversation_id: conversation.conversation_id,
    sender_id: '55555555-5555-4555-8555-555555555555',
    message_type: 'text',
    body: 'Xin chào',
    gift_transaction_id: null,
    client_message_id: '66666666-6666-4666-8666-666666666666',
    sent_at: '2026-07-30T07:00:00.000Z',
    edited_at: null,
    removed: false,
    is_own: false,
    is_read_by_other: false,
    ...overrides,
  };
}

describe('chat helpers', () => {
  it('creates valid UUID v4 client message ids for server idempotency', () => {
    expect(createChatClientMessageId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('uses keyset pagination only for full pages', () => {
    const page = Array.from({ length: 40 }, (_, index) =>
      message({
        id: `${String(index).padStart(8, '0')}-4444-4444-8444-444444444444`,
        client_message_id: `${String(index).padStart(8, '0')}-6666-4666-8666-666666666666`,
        sent_at: `2026-07-30T07:${String(59 - index).padStart(2, '0')}:00.000Z`,
      }),
    );
    expect(getOlderMessageCursor(page, 40)).toEqual({ sentAt: page[39]!.sent_at, id: page[39]!.id });
    expect(getOlderMessageCursor(page.slice(0, 39), 40)).toBeUndefined();
  });

  it('deduplicates reconnect and optimistic results by sender plus client id', () => {
    const optimistic = message({ id: '77777777-7777-4777-8777-777777777777', sent_at: '2026-07-30T07:00:00.000Z' });
    const server = message({ id: '88888888-8888-4888-8888-888888888888', sent_at: '2026-07-30T07:00:01.000Z' });
    expect(mergeChatMessagesNewestFirst([optimistic, server])).toEqual([server]);
  });

  it('formats safe conversation previews', () => {
    expect(formatConversationPreview(conversation)).toBe('Bắt đầu trò chuyện');
    expect(formatConversationPreview({ ...conversation, last_message_id: message().id, last_message_type: 'text', last_message_body: 'Chào bạn' })).toBe('Chào bạn');
    expect(formatConversationPreview({ ...conversation, last_message_id: message().id, last_message_type: 'text', last_message_body: null })).toBe('Tin nhắn không còn hiển thị');
    expect(formatConversationPreview({ ...conversation, last_message_id: message().id, last_message_type: 'gift' })).toBe('Đã gửi một món quà');
  });
});
