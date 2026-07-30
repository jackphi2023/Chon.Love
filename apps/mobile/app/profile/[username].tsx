import { phaseCFeatureFlags } from '@myfan/config';
import {
  blockUser,
  cancelFriendRequest,
  createPrivateMediaUrl,
  createSafetyReport,
  formatHeartUnits,
  getDirectConversation,
  getProfileViewer,
  getReadableChatError,
  getReadableSocialError,
  listProfileAlbumMedia,
  REPORT_REASON_OPTIONS,
  respondToFriendRequest,
  sendFriendRequest,
  unblockUser,
  type AlbumMediaItem,
  type ReportReasonCode,
} from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type AlbumItemWithUrl = AlbumMediaItem & { url: string };

function normalizeUsername(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function ProfileViewerPage() {
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const username = normalizeUsername(params.username).trim();
  const router = useRouter();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const [greeting, setGreeting] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReasonCode>('spam');
  const [reportDescription, setReportDescription] = useState('');
  const [reportMediaId, setReportMediaId] = useState<string | null>(null);

  const profileQueryKey = ['profile-viewer', auth.userId, username] as const;
  const profileQuery = useQuery({
    queryKey: profileQueryKey,
    enabled: Boolean(client && auth.userId && username),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getProfileViewer(client, username);
    },
  });

  const profile = profileQuery.data;
  const avatarQuery = useQuery({
    queryKey: ['profile-viewer', 'avatar', profile?.avatar_media_id],
    enabled: Boolean(client && profile?.avatar_storage_bucket && profile?.avatar_storage_path),
    staleTime: 45_000,
    queryFn: async () => {
      if (!client || !profile?.avatar_storage_bucket || !profile.avatar_storage_path) return null;
      return createPrivateMediaUrl(client, {
        storage_bucket: profile.avatar_storage_bucket,
        storage_path: profile.avatar_storage_path,
      });
    },
  });

  const publicAlbumQuery = useQuery({
    queryKey: ['profile-viewer', 'album', profile?.id, 'public'],
    enabled: Boolean(client && profile?.id && !profile.blocked_by_viewer),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client || !profile?.id) return [];
      const rows = await listProfileAlbumMedia(client, profile.id, 'public');
      return Promise.all(rows.map(async (row) => ({ ...row, url: await createPrivateMediaUrl(client, row) })));
    },
  });

  const fanAlbumQuery = useQuery({
    queryKey: ['profile-viewer', 'album', profile?.id, 'fan'],
    enabled: Boolean(
      client &&
        profile?.id &&
        phaseCFeatureFlags.fan_album &&
        profile.fan_album_available &&
        profile.fan_access_granted &&
        !profile.blocked_by_viewer,
    ),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client || !profile?.id) return [];
      const rows = await listProfileAlbumMedia(client, profile.id, 'fan');
      return Promise.all(rows.map(async (row) => ({ ...row, url: await createPrivateMediaUrl(client, row) })));
    },
  });

  const displayName = profile?.display_name || profile?.username || 'Thành viên MyFan';
  const profileError = profileQuery.error || publicAlbumQuery.error || fanAlbumQuery.error;
  const reportTargetLabel = reportMediaId ? 'ảnh này' : 'tài khoản này';
  const fanProgressPercent = useMemo(() => {
    if (!profile || profile.fan_threshold_units <= 0) return 0;
    return Math.min(100, Math.round((profile.fan_eligible_units / profile.fan_threshold_units) * 100));
  }, [profile]);

  async function refreshProfile() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: profileQueryKey }),
      queryClient.invalidateQueries({ queryKey: ['profile-viewer', 'album', profile?.id] }),
      queryClient.invalidateQueries({ queryKey: ['social-connections', auth.userId] }),
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations', auth.userId] }),
      queryClient.invalidateQueries({ queryKey: ['discovery', 'profiles', auth.userId] }),
    ]);
  }

  async function runSocialAction(name: string, action: () => Promise<void>, successMessage: string) {
    setBusyAction(name);
    setMessage(null);
    setErrorMessage(null);
    try {
      await action();
      await refreshProfile();
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(getReadableSocialError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSendFriendRequest() {
    if (!client || !profile) return;
    await runSocialAction(
      'friend',
      () => sendFriendRequest(client, profile.id, greeting),
      'Đã gửi lời mời kết bạn.',
    );
    setGreeting('');
  }

  async function handleRelationshipAction(action: 'accept' | 'decline' | 'cancel') {
    if (!client || !profile?.friendship_id) return;
    if (action === 'cancel') {
      await runSocialAction('friend', () => cancelFriendRequest(client, profile.friendship_id!), 'Đã hủy lời mời.');
      return;
    }
    await runSocialAction(
      'friend',
      () => respondToFriendRequest(client, profile.friendship_id!, action === 'accept'),
      action === 'accept' ? 'Hai bạn đã trở thành bạn bè. Chat đã được mở.' : 'Đã từ chối lời mời.',
    );
  }

  async function handleOpenChat() {
    if (!client || !profile) return;
    setBusyAction('chat');
    setMessage(null);
    setErrorMessage(null);
    try {
      const conversationId = await getDirectConversation(client, profile.id);
      if (!conversationId) throw new Error('conversation_not_available');
      router.push({ pathname: '/chat/[conversationId]', params: { conversationId } });
    } catch (error) {
      setErrorMessage(getReadableChatError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleBlock() {
    if (!client || !profile) return;
    await runSocialAction('block', () => blockUser(client, profile.id, 'profile_safety'), 'Đã chặn tài khoản.');
    setShowBlockConfirm(false);
  }

  async function handleUnblock() {
    if (!client || !profile) return;
    await runSocialAction(
      'block',
      () => unblockUser(client, profile.id),
      'Đã bỏ chặn tài khoản. Quan hệ bạn bè cũ không được tự động khôi phục.',
    );
  }

  async function handleReport() {
    if (!client || !profile) return;
    setBusyAction('report');
    setMessage(null);
    setErrorMessage(null);
    try {
      await createSafetyReport(client, {
        targetUserId: reportMediaId ? null : profile.id,
        targetMediaId: reportMediaId,
        reasonCode: reportReason,
        description: reportDescription,
      });
      setMessage('Báo cáo đã được gửi tới đội ngũ an toàn MyFan.');
      setShowReport(false);
      setReportMediaId(null);
      setReportDescription('');
      setReportReason('spam');
    } catch (error) {
      setErrorMessage(getReadableSocialError(error));
    } finally {
      setBusyAction(null);
    }
  }

  function openMediaReport(mediaId: string) {
    setReportMediaId(mediaId);
    setShowReport(true);
  }

  if (profileQuery.isLoading) return <LoadingScreen />;

  if (!username || !profile) {
    return (
      <View style={styles.centeredPage}>
        <Text accessibilityRole="header" style={styles.notFoundTitle}>Không tìm thấy hồ sơ</Text>
        <Text style={styles.bodyText}>Hồ sơ không tồn tại, không còn hoạt động hoặc bạn không có quyền xem.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.page}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Quay lại</Text>
        </Pressable>
        <Text style={styles.safetyLabel}>Social Creator 18+</Text>
      </View>

      <View style={styles.profileHeader}>
        {avatarQuery.data ? (
          <Image accessibilityLabel={`Ảnh đại diện của ${displayName}`} source={{ uri: avatarQuery.data }} style={styles.avatar} />
        ) : (
          <View accessibilityLabel={`Chưa có ảnh đại diện của ${displayName}`} style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>{displayName.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text accessibilityRole="header" style={styles.displayName}>{displayName}</Text>
            {profile.is_creator ? <Text style={styles.creatorBadge}>Creator</Text> : null}
          </View>
          <Text style={styles.username}>@{profile.username}</Text>
          {profile.province_name ? <Text style={styles.metaText}>{profile.province_name}</Text> : null}
        </View>
      </View>

      {profile.blocked_by_viewer ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Bạn đã chặn tài khoản này</Text>
          <Text style={styles.bodyText}>Ảnh, album, lời mời và tương tác đang bị ẩn.</Text>
          <Pressable
            accessibilityRole="button"
            disabled={busyAction !== null}
            onPress={handleUnblock}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>{busyAction === 'block' ? 'Đang xử lý…' : 'Bỏ chặn'}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FriendshipActions
            busy={busyAction === 'friend' || busyAction === 'chat'}
            direction={profile.friendship_direction}
            greeting={greeting}
            onAccept={() => handleRelationshipAction('accept')}
            onCancel={() => handleRelationshipAction('cancel')}
            onChat={handleOpenChat}
            onDecline={() => handleRelationshipAction('decline')}
            onGreetingChange={setGreeting}
            onSend={handleSendFriendRequest}
            status={profile.friendship_status}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Giới thiệu</Text>
            <Text style={styles.bodyText}>{profile.creator_bio || profile.bio || 'Chưa có phần giới thiệu.'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sở thích</Text>
            {profile.interests.length ? (
              <View style={styles.chipRow}>
                {profile.interests.map((interest) => (
                  <View key={interest} style={styles.chip}><Text style={styles.chipText}>{interest}</Text></View>
                ))}
              </View>
            ) : <Text style={styles.bodyText}>Chưa chia sẻ sở thích.</Text>}
          </View>

          <AlbumSection
            emptyText="Chưa có ảnh công khai."
            items={publicAlbumQuery.data ?? []}
            loading={publicAlbumQuery.isLoading}
            onReport={openMediaReport}
            title={`Ảnh công khai (${profile.public_album_count})`}
          />

          {profile.is_creator && profile.fan_album_available ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Album Fan</Text>
              {profile.fan_access_granted && phaseCFeatureFlags.fan_album ? (
                <AlbumGrid items={fanAlbumQuery.data ?? []} loading={fanAlbumQuery.isLoading} onReport={openMediaReport} />
              ) : (
                <View style={styles.fanLockedCard}>
                  <Text style={styles.fanTitle}>Quyền lợi cộng đồng Fan đang khóa</Text>
                  <Text style={styles.bodyText}>
                    Tiến độ ủng hộ hợp lệ: {formatHeartUnits(profile.fan_eligible_units)} / {formatHeartUnits(profile.fan_threshold_units)} ❤️.
                  </Text>
                  <View accessibilityLabel={`Tiến độ Album Fan ${fanProgressPercent}%`} style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${fanProgressPercent}%` }]} />
                  </View>
                  <Text style={styles.fanRemaining}>
                    Còn {formatHeartUnits(profile.fan_remaining_units)} ❤️ để đạt ngưỡng cộng đồng Fan.
                  </Text>
                  <Text style={styles.policyNote}>
                    Album Fan tuân theo cùng Tiêu chuẩn cộng đồng; quyền Fan không bao gồm gặp mặt, liên hệ riêng hoặc nội dung người lớn.
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          <View style={styles.safetyActions}>
            <Pressable accessibilityRole="button" onPress={() => { setReportMediaId(null); setShowReport(true); }} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Báo cáo tài khoản</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setShowBlockConfirm(true)} style={styles.dangerButton}>
              <Text style={styles.dangerButtonText}>Chặn</Text>
            </Pressable>
          </View>
        </>
      )}

      {showBlockConfirm ? (
        <View style={styles.confirmCard}>
          <Text style={styles.warningTitle}>Chặn {displayName}?</Text>
          <Text style={styles.bodyText}>Hai tài khoản sẽ không thể tìm thấy nhau, kết bạn, xem Album Fan hoặc nhắn tin.</Text>
          <View style={styles.inlineActions}>
            <Pressable accessibilityRole="button" onPress={() => setShowBlockConfirm(false)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Hủy</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busyAction !== null} onPress={handleBlock} style={styles.dangerFilledButton}>
              <Text style={styles.dangerFilledText}>{busyAction === 'block' ? 'Đang xử lý…' : 'Xác nhận chặn'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showReport ? (
        <View style={styles.reportCard}>
          <Text style={styles.warningTitle}>Báo cáo {reportTargetLabel}</Text>
          <Text style={styles.bodyText}>Chọn lý do chính. Mô tả bổ sung là tùy chọn.</Text>
          <View style={styles.chipRow}>
            {REPORT_REASON_OPTIONS.map((reason) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: reportReason === reason.code }}
                key={reason.code}
                onPress={() => setReportReason(reason.code)}
                style={[styles.reasonChip, reportReason === reason.code && styles.reasonChipActive]}
              >
                <Text style={[styles.reasonText, reportReason === reason.code && styles.reasonTextActive]}>{reason.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="Mô tả bổ sung cho báo cáo"
            maxLength={1000}
            multiline
            onChangeText={setReportDescription}
            placeholder="Mô tả ngắn sự việc"
            style={styles.textArea}
            value={reportDescription}
          />
          <View style={styles.inlineActions}>
            <Pressable accessibilityRole="button" onPress={() => { setShowReport(false); setReportMediaId(null); }} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Hủy</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busyAction !== null} onPress={handleReport} style={styles.primaryButtonCompact}>
              <Text style={styles.primaryButtonText}>{busyAction === 'report' ? 'Đang gửi…' : 'Gửi báo cáo'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
      {errorMessage || profileError ? (
        <Text accessibilityRole="alert" style={styles.error}>{errorMessage ?? 'Không thể tải đầy đủ hồ sơ. Hãy thử lại.'}</Text>
      ) : null}
    </ScrollView>
  );
}

function FriendshipActions(props: {
  busy: boolean;
  direction: 'none' | 'outgoing' | 'incoming' | 'mutual' | 'outgoing_block';
  greeting: string;
  onAccept: () => void;
  onCancel: () => void;
  onChat: () => void;
  onDecline: () => void;
  onGreetingChange: (value: string) => void;
  onSend: () => void;
  status: 'none' | 'pending' | 'accepted' | 'blocked';
}) {
  if (props.status === 'accepted') {
    return (
      <View style={styles.relationshipCard}>
        <Text style={styles.relationshipTitle}>✓ Hai bạn đã là bạn bè</Text>
        <Text style={styles.bodyText}>Chat realtime đã sẵn sàng. Tin nhắn chỉ được gửi khi quan hệ bạn bè còn hiệu lực và không có chặn.</Text>
        <Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onChat} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{props.busy ? 'Đang mở…' : 'Nhắn tin'}</Text>
        </Pressable>
      </View>
    );
  }
  if (props.status === 'pending' && props.direction === 'incoming') {
    return (
      <View style={styles.relationshipCard}>
        <Text style={styles.relationshipTitle}>Bạn có một lời mời kết bạn</Text>
        <View style={styles.inlineActions}>
          <Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onDecline} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Từ chối</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onAccept} style={styles.primaryButtonCompact}>
            <Text style={styles.primaryButtonText}>{props.busy ? 'Đang xử lý…' : 'Chấp nhận'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  if (props.status === 'pending') {
    return (
      <View style={styles.relationshipCard}>
        <Text style={styles.relationshipTitle}>Lời mời đang chờ phản hồi</Text>
        <Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onCancel} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{props.busy ? 'Đang xử lý…' : 'Hủy lời mời'}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.relationshipCard}>
      <Text style={styles.relationshipTitle}>Kết nối an toàn</Text>
      <TextInput
        accessibilityLabel="Lời chào khi gửi lời mời kết bạn"
        maxLength={280}
        multiline
        onChangeText={props.onGreetingChange}
        placeholder="Lời chào tùy chọn, tối đa 280 ký tự"
        style={styles.greetingInput}
        value={props.greeting}
      />
      <Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onSend} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>{props.busy ? 'Đang gửi…' : 'Gửi lời mời kết bạn'}</Text>
      </Pressable>
    </View>
  );
}

function AlbumSection(props: { title: string; items: AlbumItemWithUrl[]; loading: boolean; emptyText: string; onReport: (id: string) => void }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{props.title}</Text>
      <AlbumGrid items={props.items} loading={props.loading} onReport={props.onReport} />
      {!props.loading && !props.items.length ? <Text style={styles.bodyText}>{props.emptyText}</Text> : null}
    </View>
  );
}

function AlbumGrid(props: { items: AlbumItemWithUrl[]; loading: boolean; onReport: (id: string) => void }) {
  if (props.loading) return <ActivityIndicator color={colors.primary} />;
  return (
    <View style={styles.gallery}>
      {props.items.map((item) => (
        <View key={item.media_id} style={styles.galleryItem}>
          <Image accessibilityLabel="Ảnh trong album MyFan" source={{ uri: item.url }} style={styles.galleryImage} />
          <Pressable accessibilityRole="button" onPress={() => props.onReport(item.media_id)} style={styles.reportImageButton}>
            <Text style={styles.reportImageText}>Báo cáo ảnh</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.centeredPage}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.bodyText}>Đang tải…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 80, gap: spacing.md },
  centeredPage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { minHeight: 44, justifyContent: 'center', paddingRight: spacing.md },
  backButtonText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  safetyLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.border },
  avatarFallback: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FCE7F3' },
  avatarFallbackText: { color: colors.primary, fontSize: 34, fontWeight: '900' },
  identity: { flex: 1, gap: 5 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  displayName: { color: colors.text, fontSize: 24, fontWeight: '900' },
  username: { color: colors.muted, fontSize: 14 },
  metaText: { color: colors.muted, fontSize: 13 },
  creatorBadge: { color: colors.primary, backgroundColor: '#FCE7F3', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: '900' },
  section: { marginTop: spacing.md, gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  bodyText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  relationshipCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  relationshipTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  greetingInput: { minHeight: 76, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: spacing.md, color: colors.text, textAlignVertical: 'top' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primary, paddingHorizontal: spacing.md },
  primaryButtonCompact: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primary, paddingHorizontal: spacing.md },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  inlineActions: { flexDirection: 'row', gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderRadius: 999, backgroundColor: '#F3F4F6', paddingHorizontal: 11, paddingVertical: 6 },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  galleryItem: { width: '31%', minWidth: 96, gap: 5 },
  galleryImage: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: colors.border },
  reportImageButton: { minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  reportImageText: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  fanLockedCard: { borderRadius: 16, borderWidth: 1, borderColor: '#F2B51D', backgroundColor: '#FFFBEB', padding: spacing.md, gap: spacing.sm },
  fanTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  progressTrack: { height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: '#FDE68A' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#F2B51D' },
  fanRemaining: { color: '#92400E', fontSize: 13, fontWeight: '800' },
  policyNote: { color: '#92400E', fontSize: 12, lineHeight: 18 },
  safetyActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  dangerButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surface },
  dangerButtonText: { color: colors.danger, fontSize: 14, fontWeight: '800' },
  dangerFilledButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.danger },
  dangerFilledText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  warningCard: { borderRadius: 16, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', padding: spacing.md, gap: spacing.sm },
  confirmCard: { borderRadius: 16, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', padding: spacing.md, gap: spacing.md },
  reportCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.md },
  warningTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  reasonChip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 11, paddingVertical: 7 },
  reasonChipActive: { borderColor: colors.primary, backgroundColor: '#FCE7F3' },
  reasonText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  reasonTextActive: { color: colors.primary },
  textArea: { minHeight: 92, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: spacing.md, color: colors.text, textAlignVertical: 'top' },
  notFoundTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  success: { color: '#166534', fontSize: 14, lineHeight: 21 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
});
