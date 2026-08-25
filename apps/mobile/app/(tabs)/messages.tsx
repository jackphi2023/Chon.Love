import {
  formatLuxyMailboxPreview,
  getReadableLuxyMailboxError,
  listLuxyMailbox,
  setConversationArchived,
  type LuxyMailboxConversation,
} from '@myfan/supabase';
import { chonColors, luxyRadii, luxyTypography } from '@myfan/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LuxySeekingMemberPhoto } from '@/components/luxy-seeking-member-photo';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type MailboxSort = 'newest' | 'oldest';

function formatMailboxTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const now = new Date();
  const delta = Math.max(0, now.getTime() - date.getTime());
  if (delta < 60 * 60_000) return `${Math.max(1, Math.floor(delta / 60_000))} phút trước`;
  if (delta < 24 * 60 * 60_000) return `${Math.floor(delta / 3_600_000)} giờ trước`;
  if (delta < 7 * 24 * 60 * 60_000) return `${Math.floor(delta / 86_400_000)} ngày trước`;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date);
}

export default function MessagesPage() {
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= 860;
  const [sort, setSort] = useState<MailboxSort>('newest');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busyConversationId, setBusyConversationId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const mailboxQuery = useQuery({
    queryKey: ['luxy-mailbox', auth.userId],
    enabled: Boolean(client && auth.userId),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return listLuxyMailbox(client, { limit: 50, offset: 0 });
    },
  });

  const rows = mailboxQuery.data ?? [];
  const unreadTotal = useMemo(
    () => rows.reduce((sum, row) => sum + row.unread_count, 0),
    [rows],
  );

  const visibleRows = useMemo(() => rows
    .filter((row) => !unreadOnly || row.unread_count > 0)
    .sort((a, b) => {
      const left = a.last_message_sent_at ?? '';
      const right = b.last_message_sent_at ?? '';
      return sort === 'newest' ? right.localeCompare(left) : left.localeCompare(right);
    }), [rows, sort, unreadOnly]);

  async function toggleArchive(item: LuxyMailboxConversation) {
    if (!client || busyConversationId) return;
    setBusyConversationId(item.conversation_id);
    setActionError(null);
    try {
      await setConversationArchived(client, item.conversation_id, !item.is_archived);
      await queryClient.invalidateQueries({ queryKey: ['luxy-mailbox', auth.userId] });
      await queryClient.invalidateQueries({ queryKey: ['luxy-nav-messages', auth.userId] });
    } catch (error) {
      setActionError(getReadableLuxyMailboxError(error));
    } finally {
      setBusyConversationId(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} testID="luxy-messages-page">
      <View style={styles.mailbox}>
        <View style={[styles.headingRow, !desktop && styles.headingRowMobile]}>
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={styles.title}>Tin nhắn</Text>
            {unreadTotal > 0 ? (
              <View accessibilityLabel={`${unreadTotal} tin chưa đọc`} style={styles.countBadge} testID="luxy-mailbox-unread-count">
                <Text style={styles.countBadgeText}>{unreadTotal > 99 ? '99+' : unreadTotal}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.controls}>
            <Pressable
              aria-checked={unreadOnly}
              accessibilityLabel="Chỉ hiện tin chưa đọc"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: unreadOnly }}
              onPress={() => setUnreadOnly((value) => !value)}
              style={styles.checkboxControl}
              testID="luxy-mailbox-unread-only"
            >
              <View style={[styles.checkbox, unreadOnly && styles.checkboxChecked]}>
                {unreadOnly ? <Text style={styles.check}>✓</Text> : null}
              </View>
              <Text style={styles.controlText}>Chỉ chưa đọc</Text>
            </Pressable>
            <Text style={styles.filtersLabel}>Sắp xếp</Text>
            <Pressable
              accessibilityLabel="Đổi thứ tự Tin nhắn"
              accessibilityRole="button"
              onPress={() => setSort((value) => value === 'newest' ? 'oldest' : 'newest')}
              style={styles.sortButton}
              testID="luxy-mailbox-sort"
            >
              <Text style={styles.sortText}>{sort === 'newest' ? 'Mới nhất' : 'Cũ nhất'}</Text>
              <Text style={styles.chevron}>⌄</Text>
            </Pressable>
          </View>
        </View>

        {actionError ? <Text accessibilityRole="alert" style={styles.actionError}>{actionError}</Text> : null}

        {mailboxQuery.isLoading ? (
          <View style={styles.state}>
            <ActivityIndicator color={chonColors.ink} size="large" />
            <Text style={styles.stateText}>Đang tải Tin nhắn…</Text>
          </View>
        ) : mailboxQuery.error ? (
          <View style={styles.state}>
            <Text accessibilityRole="alert" style={styles.errorText}>Không thể tải Tin nhắn.</Text>
            <Pressable accessibilityRole="button" onPress={() => void mailboxQuery.refetch()} style={styles.retryButton}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : visibleRows.length === 0 ? (
          <View style={styles.state}>
            <Text style={styles.emptyTitle}>{unreadOnly ? 'Không có tin nhắn chưa đọc.' : 'Chưa có cuộc trò chuyện.'}</Text>
            <Text style={styles.stateText}>
              {unreadOnly ? 'Tắt bộ lọc để xem toàn bộ cuộc trò chuyện.' : 'Khi có tin nhắn mới, chúng sẽ xuất hiện tại đây.'}
            </Text>
          </View>
        ) : (
          <View style={styles.messageList} testID="luxy-mailbox-list">
            {visibleRows.map((item) => (
              <MailboxRow
                busy={busyConversationId === item.conversation_id}
                desktop={desktop}
                item={item}
                key={item.conversation_id}
                onArchive={() => void toggleArchive(item)}
                onOpen={() => router.push({ pathname: '/chat/[conversationId]', params: { conversationId: item.conversation_id } })}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function MailboxRow({
  item,
  desktop,
  busy,
  onOpen,
  onArchive,
}: {
  item: LuxyMailboxConversation;
  desktop: boolean;
  busy: boolean;
  onOpen: () => void;
  onArchive: () => void;
}) {
  const name = item.display_name || item.username || 'Thành viên Chọn.Love';
  const preview = formatLuxyMailboxPreview(item);

  return (
    <View style={styles.messageRow} testID="luxy-mailbox-row">
      {item.unread_count > 0 ? (
        <View accessibilityLabel={`${item.unread_count} tin chưa đọc`} style={styles.unreadDot} />
      ) : (
        <View style={styles.unreadDotSpacer} />
      )}
      <Pressable
        accessibilityLabel={`Mở cuộc trò chuyện với ${name}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
      >
        <LuxySeekingMemberPhoto
          height={desktop ? 105 : 92}
          mediaId={item.avatar_media_id}
          membershipTier={item.membership_tier}
          name={name}
          storageBucket={item.avatar_storage_bucket}
          storagePath={item.avatar_storage_path}
          width={desktop ? 78 : 70}
        />
        <View style={styles.rowBody}>
          <View style={styles.memberHeading}>
            <View style={styles.memberNameWrap}>
              {item.is_online ? <View accessibilityLabel="Đang online" style={styles.onlineDot} /> : null}
              <Text numberOfLines={1} style={[styles.memberName, item.unread_count > 0 && styles.unreadStrong]}>{name}</Text>
            </View>
            <Text style={styles.time}>{formatMailboxTime(item.last_message_sent_at)}</Text>
          </View>
          {item.headline ? <Text numberOfLines={1} style={styles.headline}>{item.headline}</Text> : null}
          <Text style={styles.location}>{item.age}, {item.province_name || 'Việt Nam'}</Text>
          <Text numberOfLines={1} style={[styles.preview, item.unread_count > 0 && styles.previewUnread]}>{preview}</Text>
          <View style={styles.statusRow}>
            {item.is_archived ? <Text style={styles.archived} testID="luxy-mailbox-archived-status">Đã lưu trữ</Text> : null}
            {!item.can_send && !item.blocked ? <Text style={styles.readOnly}>Bạn vẫn đọc được tin đến · Nâng cấp để trả lời</Text> : null}
            {item.blocked ? <Text style={styles.blocked}>Cuộc trò chuyện bị hạn chế do chặn</Text> : null}
          </View>
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel={item.is_archived ? `Khôi phục cuộc trò chuyện với ${name}` : `Lưu trữ cuộc trò chuyện với ${name}`}
        accessibilityRole="button"
        disabled={busy}
        onPress={onArchive}
        style={({ pressed }) => [styles.archiveButton, pressed && styles.archiveButtonPressed, busy && styles.disabled]}
        testID={`luxy-mailbox-archive-${item.conversation_id}`}
      >
        <Text style={styles.archiveText}>{item.is_archived ? 'Khôi phục' : 'Lưu trữ'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FBFAF9',
    minHeight: '100%',
    paddingBottom: 110,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  mailbox: {
    alignSelf: 'center',
    maxWidth: 920,
    width: '100%',
  },
  headingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingBottom: 12,
  },
  headingRowMobile: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: 10,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    color: chonColors.ink,
    fontFamily: luxyTypography.families.display,
    fontSize: 24,
    fontWeight: '400',
  },
  countBadge: {
    alignItems: 'center',
    backgroundColor: chonColors.primaryRed,
    borderRadius: 9,
    justifyContent: 'center',
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 5,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  controls: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  checkboxControl: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 38,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: chonColors.border,
    borderRadius: 2,
    borderWidth: 1,
    height: 15,
    justifyContent: 'center',
    width: 15,
  },
  checkboxChecked: {
    backgroundColor: chonColors.ink,
    borderColor: chonColors.ink,
  },
  check: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  controlText: {
    color: chonColors.text,
    fontSize: 13,
  },
  filtersLabel: {
    color: chonColors.muted,
    fontSize: 13,
  },
  sortButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: chonColors.ink,
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 15,
    justifyContent: 'space-between',
    minHeight: 32,
    minWidth: 94,
    paddingHorizontal: 11,
  },
  sortText: {
    color: chonColors.ink,
    fontSize: 12,
  },
  chevron: {
    color: chonColors.ink,
    fontSize: 13,
  },
  actionError: {
    color: chonColors.danger,
    fontSize: 12,
    marginBottom: 8,
  },
  messageList: {
    backgroundColor: '#FFFFFF',
    borderColor: chonColors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  messageRow: {
    alignItems: 'center',
    borderBottomColor: chonColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 145,
    paddingHorizontal: 13,
    paddingVertical: 16,
  },
  unreadDot: {
    backgroundColor: chonColors.primaryRed,
    borderRadius: 4,
    height: 7,
    marginRight: 7,
    width: 7,
  },
  unreadDotSpacer: {
    marginRight: 7,
    width: 7,
  },
  rowMain: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    gap: 9,
    minWidth: 0,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  memberHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  memberNameWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    minWidth: 0,
  },
  onlineDot: {
    backgroundColor: chonColors.online,
    borderRadius: 5,
    height: 9,
    width: 9,
  },
  memberName: {
    color: chonColors.ink,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  unreadStrong: {
    fontWeight: '700',
  },
  time: {
    color: chonColors.muted,
    fontSize: 10,
    marginLeft: 8,
  },
  headline: {
    color: chonColors.text,
    fontSize: 11.5,
    marginTop: 5,
  },
  location: {
    color: chonColors.muted,
    fontSize: 11.5,
    marginTop: 4,
  },
  preview: {
    color: chonColors.text,
    fontSize: 12.5,
    marginTop: 8,
  },
  previewUnread: {
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 5,
  },
  archived: {
    color: chonColors.goldStrong,
    fontSize: 10.5,
    fontWeight: '600',
  },
  readOnly: {
    color: chonColors.primaryRed,
    fontSize: 10.5,
  },
  blocked: {
    color: chonColors.danger,
    fontSize: 10.5,
  },
  archiveButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: chonColors.gold,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    marginLeft: 10,
    minHeight: 32,
    minWidth: 76,
    paddingHorizontal: 11,
  },
  archiveButtonPressed: {
    backgroundColor: chonColors.warmSurfaceStrong,
  },
  archiveText: {
    color: chonColors.ink,
    fontSize: 11,
    fontWeight: '600',
  },
  state: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    minHeight: 330,
    paddingHorizontal: 22,
  },
  stateText: {
    color: chonColors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyTitle: {
    color: chonColors.ink,
    fontFamily: luxyTypography.families.display,
    fontSize: 19,
    textAlign: 'center',
  },
  errorText: {
    color: chonColors.danger,
    fontSize: 13,
  },
  retryButton: {
    backgroundColor: chonColors.ink,
    borderRadius: luxyRadii.pill,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 23,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.5,
  },
});
