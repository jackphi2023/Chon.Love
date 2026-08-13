import {
  formatLuxyMailboxPreview,
  getReadableLuxyMailboxError,
  listLuxyMailbox,
  setConversationArchived,
  type LuxyMailboxConversation,
} from '@myfan/supabase';
import { luxyColors, luxyRadii, luxyTypography } from '@myfan/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LuxySeekingMemberPhoto } from '@/components/luxy-seeking-member-photo';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type MailboxFolder = 'inbox' | 'filtered' | 'sent' | 'archive';
type MailboxSort = 'newest' | 'oldest';

const FOLDERS: Array<{ key: MailboxFolder; label: string }> = [
  { key: 'inbox', label: 'Tin nhắn đến' },
  { key: 'filtered', label: 'Đã lọc' },
  { key: 'sent', label: 'Đã gửi' },
  { key: 'archive', label: 'Lưu trữ' },
];

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
  const [folder, setFolder] = useState<MailboxFolder>('inbox');
  const [sort, setSort] = useState<MailboxSort>('newest');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [promoVisible, setPromoVisible] = useState(true);
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
  const inboxUnread = useMemo(
    () => rows.filter((row) => !row.is_archived && !row.blocked).reduce((sum, row) => sum + row.unread_count, 0),
    [rows],
  );

  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('vi-VN');
    return rows
      .filter((row) => {
        if (folder === 'archive') return row.is_archived;
        if (row.is_archived) return false;
        if (folder === 'filtered') return row.blocked;
        if (folder === 'sent') return row.last_message_sender_id === auth.userId;
        return !row.blocked;
      })
      .filter((row) => !unreadOnly || row.unread_count > 0)
      .filter((row) => {
        if (!term) return true;
        return [row.display_name, row.username, row.headline, row.province_name, row.last_message_body]
          .some((value) => value?.toLocaleLowerCase('vi-VN').includes(term));
      })
      .sort((a, b) => {
        const left = a.last_message_sent_at ?? '';
        const right = b.last_message_sent_at ?? '';
        return sort === 'newest' ? right.localeCompare(left) : left.localeCompare(right);
      });
  }, [auth.userId, folder, rows, search, sort, unreadOnly]);

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
      <View style={[styles.mailbox, !desktop && styles.mailboxMobile]}>
        <View style={[styles.sidebar, !desktop && styles.sidebarMobile]}>
          <View accessibilityRole="tablist" style={[styles.folderList, !desktop && styles.folderListMobile]}>
            {FOLDERS.map((item) => {
              const active = folder === item.key;
              const badge = item.key === 'inbox' ? inboxUnread : 0;
              return (
                <Pressable
                  accessibilityLabel={item.label}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  key={item.key}
                  onPress={() => setFolder(item.key)}
                  style={[styles.folderButton, active && styles.folderButtonActive, !desktop && styles.folderButtonMobile]}
                  testID={`luxy-mailbox-folder-${item.key}`}
                >
                  <Text style={[styles.folderText, active && styles.folderTextActive]}>{item.label}</Text>
                  {badge > 0 ? <View style={styles.countBadge}><Text style={styles.countBadgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.searchBox, !desktop && styles.searchBoxMobile]}>
            <TextInput
              accessibilityLabel="Tìm trong Tin nhắn"
              onChangeText={setSearch}
              placeholder="Tìm tin nhắn"
              placeholderTextColor="#9098A1"
              style={styles.searchInput}
              value={search}
            />
            <Text accessibilityElementsHidden style={styles.searchIcon}>⌕</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={[styles.headingRow, !desktop && styles.headingRowMobile]}>
            <Text accessibilityRole="header" style={styles.title}>{folder === 'inbox' ? 'Tin nhắn đến' : FOLDERS.find((item) => item.key === folder)?.label}</Text>
            <View style={styles.controls}>
              <Pressable
                accessibilityLabel="Chỉ hiện tin chưa đọc"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: unreadOnly }}
                onPress={() => setUnreadOnly((value) => !value)}
                style={styles.checkboxControl}
                testID="luxy-mailbox-unread-only"
              >
                <View style={[styles.checkbox, unreadOnly && styles.checkboxChecked]}>{unreadOnly ? <Text style={styles.check}>✓</Text> : null}</View>
                <Text style={styles.controlText}>Chỉ chưa đọc</Text>
              </Pressable>
              <Text style={styles.filtersLabel}>Bộ lọc</Text>
              <Pressable
                accessibilityLabel="Đổi thứ tự Tin nhắn"
                accessibilityRole="button"
                onPress={() => setSort((value) => value === 'newest' ? 'oldest' : 'newest')}
                style={styles.sortButton}
                testID="luxy-mailbox-sort"
              >
                <Text style={styles.sortText}>{sort === 'newest' ? 'Mới nhất' : 'Cũ nhất'}</Text><Text style={styles.chevron}>⌄</Text>
              </Pressable>
            </View>
          </View>

          {promoVisible ? (
            <View style={styles.promo} testID="luxy-mailbox-diamond-promo">
              <Text style={styles.promoIcon}>◇</Text>
              <Text style={styles.promoText}>Diamond là hạng thành viên cao nhất của Luxy.Love. <Text style={styles.promoLink}>Tìm hiểu thêm</Text></Text>
              <Pressable accessibilityLabel="Đóng thông tin Diamond" accessibilityRole="button" onPress={() => setPromoVisible(false)} style={styles.promoClose}>
                <Text style={styles.promoCloseText}>×</Text>
              </Pressable>
            </View>
          ) : null}

          {actionError ? <Text accessibilityRole="alert" style={styles.actionError}>{actionError}</Text> : null}

          {mailboxQuery.isLoading ? (
            <View style={styles.state}><ActivityIndicator color={luxyColors.ink} size="large" /><Text style={styles.stateText}>Đang tải Tin nhắn…</Text></View>
          ) : mailboxQuery.error ? (
            <View style={styles.state}>
              <Text accessibilityRole="alert" style={styles.errorText}>Không thể tải Tin nhắn.</Text>
              <Pressable accessibilityRole="button" onPress={() => void mailboxQuery.refetch()} style={styles.retryButton}><Text style={styles.retryText}>Thử lại</Text></Pressable>
            </View>
          ) : visibleRows.length === 0 ? (
            <View style={styles.state}>
              <Text style={styles.emptyTitle}>{search.trim() ? 'Không tìm thấy cuộc trò chuyện phù hợp.' : 'Chưa có cuộc trò chuyện trong mục này.'}</Text>
              <Text style={styles.stateText}>{folder === 'inbox' ? 'Khi có tin nhắn mới, chúng sẽ xuất hiện tại đây.' : 'Bạn có thể đổi mục ở cột bên trái.'}</Text>
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
  const name = item.display_name || item.username || 'Thành viên Luxy';
  const preview = formatLuxyMailboxPreview(item);
  return (
    <View style={styles.messageRow} testID="luxy-mailbox-row">
      {item.unread_count > 0 ? <View accessibilityLabel={`${item.unread_count} tin chưa đọc`} style={styles.unreadDot} /> : <View style={styles.unreadDotSpacer} />}
      <Pressable accessibilityLabel={`Mở cuộc trò chuyện với ${name}`} accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
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
          {!item.can_send && !item.blocked ? <Text style={styles.readOnly}>Bạn vẫn đọc được tin đến · Nâng cấp để trả lời</Text> : null}
          {item.blocked ? <Text style={styles.blocked}>Cuộc trò chuyện đã bị lọc do chặn</Text> : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel={item.is_archived ? `Khôi phục cuộc trò chuyện với ${name}` : `Lưu trữ cuộc trò chuyện với ${name}`}
        accessibilityRole="button"
        disabled={busy}
        onPress={onArchive}
        style={({ pressed }) => [styles.archiveButton, pressed && styles.pressed, busy && styles.disabled]}
      >
        <Text style={styles.archiveText}>{item.is_archived ? '↺' : '×'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#FBFAF9', minHeight: '100%', paddingBottom: 110, paddingHorizontal: 16, paddingTop: 20 },
  mailbox: { alignSelf: 'center', flexDirection: 'row', gap: 44, maxWidth: 1140, width: '100%' },
  mailboxMobile: { flexDirection: 'column', gap: 14 },
  sidebar: { flexShrink: 0, width: 298 },
  sidebarMobile: { width: '100%' },
  folderList: { borderBottomColor: '#E6E3E0', borderBottomWidth: 1 },
  folderListMobile: { borderBottomWidth: 0, flexDirection: 'row', flexWrap: 'wrap' },
  folderButton: { alignItems: 'center', borderBottomColor: '#E6E3E0', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 20 },
  folderButtonActive: { borderBottomColor: '#B9B9B9' },
  folderButtonMobile: { borderColor: '#DDDAD7', borderRadius: 6, borderWidth: 1, flexGrow: 1, minHeight: 42, minWidth: 120 },
  folderText: { color: '#34404C', fontSize: 14 },
  folderTextActive: { color: luxyColors.ink, fontWeight: '700' },
  countBadge: { alignItems: 'center', backgroundColor: luxyColors.brandCoral, borderRadius: 5, justifyContent: 'center', minHeight: 18, minWidth: 18, paddingHorizontal: 4 },
  countBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  searchBox: { alignItems: 'center', borderColor: '#D9D6D3', borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginTop: 16, minHeight: 43, paddingHorizontal: 14 },
  searchBoxMobile: { marginTop: 10 },
  searchInput: { color: luxyColors.ink, flex: 1, fontSize: 14, minHeight: 41, outlineStyle: 'none' as never },
  searchIcon: { color: luxyColors.ink, fontSize: 19 },
  content: { flex: 1, minWidth: 0 },
  headingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 40 },
  headingRowMobile: { alignItems: 'flex-start', flexDirection: 'column', gap: 10 },
  title: { color: luxyColors.ink, fontFamily: luxyTypography.families.display, fontSize: 24, fontWeight: '400' },
  controls: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  checkboxControl: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 38 },
  checkbox: { alignItems: 'center', borderColor: '#D8DADD', borderRadius: 2, borderWidth: 1, height: 15, justifyContent: 'center', width: 15 },
  checkboxChecked: { backgroundColor: luxyColors.ink, borderColor: luxyColors.ink },
  check: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  controlText: { color: '#34404C', fontSize: 13 },
  filtersLabel: { color: '#7A828B', fontSize: 13 },
  sortButton: { alignItems: 'center', borderColor: luxyColors.ink, borderRadius: 7, borderWidth: 1, flexDirection: 'row', gap: 15, justifyContent: 'space-between', minHeight: 31, minWidth: 92, paddingHorizontal: 11 },
  sortText: { color: luxyColors.ink, fontSize: 12 },
  chevron: { color: luxyColors.ink, fontSize: 13 },
  promo: { alignItems: 'center', backgroundColor: '#E7E7E9', flexDirection: 'row', gap: 12, marginTop: 10, minHeight: 74, paddingHorizontal: 24 },
  promoIcon: { color: '#B7A06C', fontSize: 23 },
  promoText: { color: '#273442', flex: 1, fontSize: 12.5, lineHeight: 18 },
  promoLink: { color: luxyColors.brandCoral },
  promoClose: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  promoCloseText: { color: '#56616C', fontSize: 31, fontWeight: '300' },
  actionError: { color: luxyColors.danger, fontSize: 12, marginTop: 8 },
  messageList: { backgroundColor: '#FFFFFF', borderBottomColor: '#E0DEDC', borderBottomWidth: 1 },
  messageRow: { alignItems: 'center', borderBottomColor: '#E1DFDD', borderBottomWidth: 1, flexDirection: 'row', minHeight: 145, paddingHorizontal: 13, paddingVertical: 16 },
  unreadDot: { backgroundColor: '#8E969E', borderRadius: 4, height: 7, marginRight: 6, width: 7 },
  unreadDotSpacer: { marginRight: 6, width: 7 },
  rowMain: { alignItems: 'flex-start', flex: 1, flexDirection: 'row', gap: 9, minWidth: 0 },
  rowBody: { flex: 1, minWidth: 0, paddingTop: 1 },
  memberHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minWidth: 0 },
  memberNameWrap: { alignItems: 'center', flexDirection: 'row', gap: 5, minWidth: 0 },
  onlineDot: { backgroundColor: '#65C778', borderRadius: 5, height: 9, width: 9 },
  memberName: { color: luxyColors.ink, flexShrink: 1, fontSize: 14, fontWeight: '500' },
  unreadStrong: { fontWeight: '700' },
  time: { color: '#8D959D', fontSize: 10, marginLeft: 8 },
  headline: { color: '#34404C', fontSize: 11.5, marginTop: 5 },
  location: { color: '#73808B', fontSize: 11.5, marginTop: 4 },
  preview: { color: '#273442', fontSize: 12.5, marginTop: 8 },
  previewUnread: { fontWeight: '600' },
  readOnly: { color: luxyColors.brandCoral, fontSize: 10.5, marginTop: 5 },
  blocked: { color: '#8D4B48', fontSize: 10.5, marginTop: 5 },
  archiveButton: { alignItems: 'center', height: 44, justifyContent: 'center', marginLeft: 10, width: 44 },
  archiveText: { color: '#56616C', fontSize: 31, fontWeight: '300' },
  state: { alignItems: 'center', gap: 12, justifyContent: 'center', minHeight: 330, paddingHorizontal: 22 },
  stateText: { color: luxyColors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  emptyTitle: { color: luxyColors.ink, fontFamily: luxyTypography.families.display, fontSize: 19, textAlign: 'center' },
  errorText: { color: luxyColors.danger, fontSize: 13 },
  retryButton: { backgroundColor: luxyColors.ink, borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 42, paddingHorizontal: 23 },
  retryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});