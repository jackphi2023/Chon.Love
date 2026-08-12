import { describe, expect, it, vi } from 'vitest';
import {
  formatLuxyMailboxPreview,
  getReadableLuxyMailboxError,
  listLuxyMailbox,
  openLuxyProfileConversation,
  setConversationArchived,
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
  friendship_status: 'direct',
  can_send: false,
  blocked: false,
  is_archived: false,
  last_message_id: '26000000-0000-4000-8000-000000000010',
  last_message_type: 'text',
  last_message_body: 'Xin chào Luxy',
  last_message_sender_id: profileId,
  last_message_sent_at: '2026-08-12T08:00:00.000Z',
  unread_count: 1,
} as const;

describe('Luxy LX-16 mailbox client contract', () => {
  it('parses the Seeking mailbox read model while preserving nullable friendship', async () => {
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
});
