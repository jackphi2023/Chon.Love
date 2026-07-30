import {
  cancelFriendRequest,
  getReadableSocialError,
  listMyBlockedProfiles,
  listMySocialConnections,
  respondToFriendRequest,
  unblockUser,
  type BlockedProfile,
  type SocialConnection,
  type SocialConnectionView,
} from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SocialAvatar } from '@/components/social-avatar';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type FriendsTab = SocialConnectionView | 'blocked';
type FriendsRow =
  | { kind: 'connection'; data: SocialConnection }
  | { kind: 'blocked'; data: BlockedProfile };

const tabs: Array<{ value: FriendsTab; label: string }> = [
  { value: 'friends', label: 'Bạn bè' },
  { value: 'received', label: 'Đã nhận' },
  { value: 'sent', label: 'Đã gửi' },
  { value: 'blocked', label: 'Đã chặn' },
];

export default function FriendsPage() {
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FriendsTab>('friends');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queryKey = ['social-connections', auth.userId, tab] as const;
  const listQuery = useQuery<FriendsRow[]>({
    queryKey,
    enabled: Boolean(client && auth.userId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      if (tab === 'blocked') {
        return (await listMyBlockedProfiles(client)).map((data) => ({ kind: 'blocked' as const, data }));
      }
      return (await listMySocialConnections(client, tab)).map((data) => ({ kind: 'connection' as const, data }));
    },
  });

  async function refreshSocialLists() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['social-connections', auth.userId] }),
      queryClient.invalidateQueries({ queryKey: ['profile-viewer', auth.userId] }),
      queryClient.invalidateQueries({ queryKey: ['discovery', 'profiles', auth.userId] }),
    ]);
  }

  async function runAction(id: string, action: () => Promise<void>, success: string) {
    setBusyId(id);
    setMessage(null);
    setErrorMessage(null);
    try {
      await action();
      await refreshSocialLists();
      setMessage(success);
    } catch (error) {
      setErrorMessage(getReadableSocialError(error));
    } finally {
      setBusyId(null);
    }
  }

  async function handleResponse(item: SocialConnection, accept: boolean) {
    if (!client) return;
    await runAction(
      item.friendship_id,
      () => respondToFriendRequest(client, item.friendship_id, accept),
      accept ? 'Đã chấp nhận lời mời kết bạn.' : 'Đã từ chối lời mời.',
    );
  }

  async function handleCancel(item: SocialConnection) {
    if (!client) return;
    await runAction(
      item.friendship_id,
      () => cancelFriendRequest(client, item.friendship_id),
      'Đã hủy lời mời kết bạn.',
    );
  }

  async function handleUnblock(item: BlockedProfile) {
    if (!client) return;
    await runAction(
      item.blocked_user_id,
      () => unblockUser(client, item.blocked_user_id),
      'Đã bỏ chặn tài khoản.',
    );
  }

  const rows = listQuery.data ?? [];
  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={(row) => row.kind === 'blocked' ? row.data.blocked_user_id : row.data.friendship_id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>Kết nối</Text>
            <Text style={styles.description}>
              Chat chỉ mở sau khi lời mời kết bạn được chấp nhận. Chặn sẽ ngắt toàn bộ tương tác giữa hai tài khoản.
            </Text>
            <View accessibilityRole="tablist" style={styles.tabs}>
              {tabs.map((item) => (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === item.value }}
                  key={item.value}
                  onPress={() => setTab(item.value)}
                  style={[styles.tab, tab === item.value && styles.tabActive]}
                >
                  <Text style={[styles.tabText, tab === item.value && styles.tabTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
            {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          listQuery.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.muted}>Đang tải…</Text>
            </View>
          ) : listQuery.error ? (
            <Text accessibilityRole="alert" style={styles.error}>Không thể tải danh sách. Hãy thử lại.</Text>
          ) : (
            <Text style={styles.empty}>{emptyTextForTab(tab)}</Text>
          )
        }
        onRefresh={() => void listQuery.refetch()}
        refreshing={listQuery.isRefetching}
        renderItem={({ item }) => item.kind === 'blocked' ? (
          <BlockedRow
            busy={busyId === item.data.blocked_user_id}
            item={item.data}
            onUnblock={() => handleUnblock(item.data)}
          />
        ) : (
          <ConnectionRow
            busy={busyId === item.data.friendship_id}
            item={item.data}
            onAccept={() => handleResponse(item.data, true)}
            onCancel={() => handleCancel(item.data)}
            onDecline={() => handleResponse(item.data, false)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function ConnectionRow({
  item,
  busy,
  onAccept,
  onDecline,
  onCancel,
}: {
  item: SocialConnection;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const name = item.display_name || item.username || 'Thành viên MyFan';
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        disabled={!item.username}
        onPress={() => item.username && router.push({ pathname: '/profile/[username]', params: { username: item.username } })}
        style={styles.identityRow}
      >
        <SocialAvatar
          mediaId={item.avatar_media_id}
          name={name}
          storageBucket={item.avatar_storage_bucket}
          storagePath={item.avatar_storage_path}
        />
        <View style={styles.cardBody}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>{name}</Text>
            {item.is_creator ? <Text style={styles.creatorBadge}>Creator</Text> : null}
          </View>
          {item.username ? <Text style={styles.username}>@{item.username}</Text> : null}
          {item.province_name ? <Text style={styles.muted}>{item.province_name}</Text> : null}
          {item.greeting_message ? <Text numberOfLines={2} style={styles.greeting}>“{item.greeting_message}”</Text> : null}
        </View>
      </Pressable>

      {item.friendship_status === 'accepted' ? (
        <View style={styles.acceptedRow}>
          <Text style={styles.acceptedText}>✓ Bạn bè</Text>
          <Text style={styles.muted}>Tin nhắn mở trong Phiên 19</Text>
        </View>
      ) : item.direction === 'incoming' ? (
        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onDecline} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Từ chối</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onAccept} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{busy ? 'Đang xử lý…' : 'Chấp nhận'}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.secondaryButtonWide}>
          <Text style={styles.secondaryButtonText}>{busy ? 'Đang xử lý…' : 'Hủy lời mời'}</Text>
        </Pressable>
      )}
    </View>
  );
}

function BlockedRow({ item, busy, onUnblock }: { item: BlockedProfile; busy: boolean; onUnblock: () => void }) {
  const name = item.display_name || item.username || 'Tài khoản MyFan';
  return (
    <View style={styles.card}>
      <View style={styles.identityRow}>
        <SocialAvatar mediaId={null} name={name} storageBucket={null} storagePath={null} />
        <View style={styles.cardBody}>
          <Text style={styles.name}>{name}</Text>
          {item.username ? <Text style={styles.username}>@{item.username}</Text> : null}
          <Text style={styles.muted}>Đã chặn</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onUnblock} style={styles.secondaryButtonWide}>
        <Text style={styles.secondaryButtonText}>{busy ? 'Đang xử lý…' : 'Bỏ chặn'}</Text>
      </Pressable>
    </View>
  );
}

function emptyTextForTab(tab: FriendsTab): string {
  if (tab === 'received') return 'Chưa có lời mời kết bạn mới.';
  if (tab === 'sent') return 'Bạn chưa gửi lời mời nào đang chờ.';
  if (tab === 'blocked') return 'Bạn chưa chặn tài khoản nào.';
  return 'Danh sách bạn bè đang trống.';
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tab: { minHeight: 40, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 13 },
  tabActive: { borderColor: colors.primary, backgroundColor: '#FCE7F3' },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: colors.primary },
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.md, marginBottom: spacing.md },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardBody: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  name: { color: colors.text, fontSize: 17, fontWeight: '900' },
  username: { color: colors.muted, fontSize: 13 },
  muted: { color: colors.muted, fontSize: 13 },
  creatorBadge: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  greeting: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  primaryButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  secondaryButtonWide: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  acceptedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  acceptedText: { color: '#166534', fontSize: 14, fontWeight: '900' },
  loading: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  empty: { color: colors.muted, fontSize: 15, textAlign: 'center', paddingVertical: spacing.xl },
  success: { color: '#166534', fontSize: 14, lineHeight: 21 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
});
