import { describe, expect, it, vi } from 'vitest';
import {
  CHAT_AUTO_DELETE_MS,
  CHAT_RETENTION_DELETED_PLACEHOLDER,
  createChatClientMessageId,
  filterExpiredChatMessages,
  formatConversationPreview,
  getConversationRetention,
  getNextChatExpiryMs,
  getOlderMessageCursor,
  hasRetentionDeletedMessages,
  mergeChatMessagesNewestFirst,
  setConversationAutoDelete,
  type ChatMessage,
  type ConversationRetention,
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
  retention_purged_at: null,
  last_message_id: null,
  last_message_type: null,
  last_message_body: null,
  last_message_sender_id: null,
  last_message_sent_at: null,
  unread_count: 0,
};

const retention: ConversationRetention = {
  conversation_id: conversation.conversation_id,
  auto_delete_enabled: true,
  auto_delete_after_days: 7,
  updated_at: '2026-07-30T07:00:00.000Z',
  purged_at: null,
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

  it('normalizes a disabled SQL retention flag from null to false and accepts pre-MSG02 responses', async () => {
    const disabledRow = {
      conversation_id: conversation.conversation_id,
      auto_delete_enabled: null,
      auto_delete_after_days: null,
      updated_at: null,
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ error: null, data: [disabledRow] })
      .mockResolvedValueOnce({ error: null, data: [{ ...disabledRow, deleted_messages: 0 }] });

    await expect(getConversationRetention({ rpc } as never, conversation.conversation_id)).resolves.toEqual({
      ...disabledRow,
      auto_delete_enabled: false,
    });
    await expect(setConversationAutoDelete({ rpc } as never, conversation.conversation_id, false)).resolves.toEqual({
      ...disabledRow,
      auto_delete_enabled: false,
      deleted_messages: 0,
    });
  });

  it('physically expires client-visible messages at seven days when enabled', () => {
    const now = Date.parse('2026-07-30T07:00:00.000Z');
    const expired = message({ sent_at: new Date(now - CHAT_AUTO_DELETE_MS).toISOString() });
    const fresh = message({
      id: '99999999-9999-4999-8999-999999999999',
      client_message_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      sent_at: new Date(now - CHAT_AUTO_DELETE_MS + 1).toISOString(),
    });
    expect(filterExpiredChatMessages([expired, fresh], retention, now)).toEqual([fresh]);
    expect(filterExpiredChatMessages([expired, fresh], { ...retention, auto_delete_enabled: false, auto_delete_after_days: null }, now)).toHaveLength(2);
  });

  it('returns the next local expiry deadline for an open conversation', () => {
    const now = Date.parse('2026-07-30T07:00:00.000Z');
    const fresh = message({ sent_at: new Date(now - 1_000).toISOString() });
    expect(getNextChatExpiryMs([fresh], retention, now)).toBe(now - 1_000 + CHAT_AUTO_DELETE_MS);
    expect(getNextChatExpiryMs([fresh], { ...retention, auto_delete_enabled: false, auto_delete_after_days: null }, now)).toBeNull();
  });

  it('formats safe conversation previews and only uses the deleted placeholder after a server purge', () => {
    expect(formatConversationPreview(conversation)).toBe('Bắt đầu trò chuyện');
    expect(formatConversationPreview({ ...conversation, retention_purged_at: '2026-08-24T15:20:00.000Z' }))
      .toBe(CHAT_RETENTION_DELETED_PLACEHOLDER);
    expect(formatConversationPreview({ ...conversation, last_message_id: message().id, last_message_type: 'text', last_message_body: 'Chào bạn' })).toBe('Chào bạn');
    expect(formatConversationPreview({ ...conversation, last_message_id: message().id, last_message_type: 'text', last_message_body: null })).toBe('Tin nhắn không còn hiển thị');
    expect(formatConversationPreview({ ...conversation, last_message_id: message().id, last_message_type: 'gift' })).toBe('Đã gửi một món quà');
    expect(hasRetentionDeletedMessages({ ...retention, purged_at: '2026-08-24T15:20:00.000Z' })).toBe(true);
    expect(hasRetentionDeletedMessages(retention)).toBe(false);
  });
});
