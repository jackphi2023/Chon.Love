import { describe, expect, it, vi } from 'vitest';
import { CHAT_RETENTION_DELETED_PLACEHOLDER } from './chat';
import {
  formatLuxyMailboxPreview,
  getReadableLuxyMailboxError,
  listLuxyMailbox,
  openLuxyProfileConversation,
  setConversationArchived,
  subscribeToLuxyMailboxRealtime,
  unsubscribeFromLuxyMailboxRealtime,
} from './mailbox';

const conversationId = '26000000-0000-4000-8000-000000000001';
const profileId = '26000000-0000-4000-8000-000000000002';

const row = {
  conversation_id: conversationId,
  friendship_id: null,
  other_user_id: profileId,
  username: 'kate',
  display_name: 'Kate',
  age: 36,
  headline: 'Du lịch, kinh doanh và sự tử tế',
  province_name: 'Thành phố Hồ Chí Minh',
  avatar_media_id: null,
  avatar_storage_bucket: null,
  avatar_storage_path: null,
  is_creator: false,
  is_online: true,
  membership_tier: 'diamond',
  friendship_status: 'direct',
  can_send: false,
  blocked: false,
  is_archived: false,
  retention_purged_at: null,
  last_message_id: '26000000-0000-4000-8000-000000000010',
  last_message_type: 'text',
  last_message_body: 'Xin chào Luxy',
  last_message_sender_id: profileId,
  last_message_sent_at: '2026-08-12T08:00:00.000Z',
  unread_count: 1,
} as const;

describe('Luxy LX-16/LX-17 mailbox client contract', () => {
  it('parses the Seeking mailbox read model while preserving nullable friendship and paid tier', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null, data: [row] });
    await expect(listLuxyMailbox({ rpc } as never)).resolves.toEqual([row]);
    expect(rpc).toHaveBeenCalledWith('list_my_conversations', { p_limit: 30, p_offset: 0 });
  });

  it('archives a conversation only through the member-owned RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null, data: true });
    await expect(setConversationArchived({ rpc } as never, conversationId, true)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('set_conversation_archived', {
      p_conversation_id: conversationId,
      p_archived: true,
    });
  });

  it('uses the LX-15 paid get-or-create boundary for starting a conversation', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null, data: conversationId });
    await expect(openLuxyProfileConversation({ rpc } as never, profileId)).resolves.toBe(conversationId);
    expect(rpc).toHaveBeenCalledWith('get_luxy_profile_conversation', { p_profile_id: profileId });
  });

  it('keeps Free incoming messages readable rather than inventing Seeking upgrade-to-read', () => {
    expect(formatLuxyMailboxPreview(row)).toBe('Xin chào Luxy');
    expect(row.can_send).toBe(false);
    expect(getReadableLuxyMailboxError({ message: 'premium_membership_required' }))
      .toContain('Nâng cấp Premium hoặc Diamond để gửi tin nhắn');
  });

  it('shows the exact seven-day deletion placeholder only when the server purge marker exists', () => {
    const physicallyPurged = {
      ...row,
      retention_purged_at: '2026-08-24T15:20:00.000Z',
      last_message_id: null,
      last_message_type: null,
      last_message_body: null,
      last_message_sender_id: null,
      last_message_sent_at: null,
      unread_count: 0,
    } as const;
    expect(formatLuxyMailboxPreview(physicallyPurged)).toBe(CHAT_RETENTION_DELETED_PLACEHOLDER);
    expect(CHAT_RETENTION_DELETED_PLACEHOLDER).toBe('Tin nhắn đã xoá sau 7 ngày');
    expect(formatLuxyMailboxPreview({ ...physicallyPurged, retention_purged_at: null })).toBe('Chưa có tin nhắn');
  });

  it('uses one viewer-scoped realtime channel for message, own-member, and conversation changes', () => {
    const listeners: Array<{ config: Record<string, unknown>; callback: () => void }> = [];
    let statusCallback: ((status: string) => void) | undefined;
    let channelName = '';
    const channel = {
      on: vi.fn((_kind, config, callback) => {
        listeners.push({ config, callback });
        return channel;
      }),
      subscribe: vi.fn((callback) => {
        statusCallback = callback;
        return channel;
      }),
    };
    const client = {
      channel: vi.fn((name: string) => {
        channelName = name;
        return channel;
      }),
    };
    const onChange = vi.fn();
    const onStatus = vi.fn();

    const result = subscribeToLuxyMailboxRealtime(client as never, {
      userId: profileId,
      onChange,
      onStatus,
    });

    expect(result).toBe(channel);
    expect(client.channel).toHaveBeenCalledTimes(1);
    expect(channelName).toMatch(new RegExp(`^mailbox:${profileId}:`));
    expect(channel.on).toHaveBeenCalledTimes(4);
    expect(listeners.map(({ config }) => config)).toEqual([
      { event: 'INSERT', schema: 'public', table: 'messages' },
      { event: 'UPDATE', schema: 'public', table: 'messages' },
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_members',
        filter: `user_id=eq.${profileId}`,
      },
      { event: 'UPDATE', schema: 'public', table: 'conversations' },
    ]);

    listeners[0]?.callback();
    listeners[2]?.callback();
    listeners[3]?.callback();
    expect(onChange.mock.calls.map(([source]) => source)).toEqual(['message', 'member', 'conversation']);

    statusCallback?.('SUBSCRIBED');
    statusCallback?.('TIMED_OUT');
    statusCallback?.('CHANNEL_ERROR');
    statusCallback?.('CLOSED');
    expect(onStatus).toHaveBeenNthCalledWith(1, 'connecting');
    expect(onStatus).toHaveBeenNthCalledWith(2, 'connected');
    expect(onStatus).toHaveBeenNthCalledWith(3, 'reconnecting');
    expect(onStatus).toHaveBeenNthCalledWith(4, 'error');
    expect(onStatus).toHaveBeenNthCalledWith(5, 'closed');
  });

  it('removes the mailbox channel during lifecycle cleanup', async () => {
    const channel = { topic: 'mailbox:test' };
    const removeChannel = vi.fn().mockResolvedValue('ok');
    await expect(unsubscribeFromLuxyMailboxRealtime({ removeChannel } as never, channel as never)).resolves.toBeUndefined();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
