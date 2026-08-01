import {
  blockUser,
  cancelFriendRequest,
  createPrivateMediaUrl,
  createSafetyReport,
  formatApproximateDistance,
  getDirectConversation,
  getProfileViewer,
  getReadableChatError,
  getReadableSocialError,
  REPORT_REASON_OPTIONS,
  respondToFriendRequest,
  sendFriendRequest,
  unblockUser,
  type ReportReasonCode,
} from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
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
import { CreatorActivityList } from '@/components/creator-activity';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

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

  const displayName = profile?.display_name || profile?.username || 'Thành viên MyFan';

  async function refreshProfile() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: profileQueryKey }),
      queryClient.invalidateQueries({ queryKey: ['social-connections', auth.userId] }),
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations', auth.userId] }),
      queryClient.invalidateQueries({ queryKey: ['discovery', 'profiles', auth.userId] }),
      queryClient.invalidateQueries({ queryKey: ['creator-activity'] }),
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
    await runSocialAction('friend', () => sendFriendRequest(client, profile.id, greeting), 'Đã gửi lời mời kết bạn.');
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
      action === 'accept' ? 'Hai bạn đã trở thành bạn bè. Quyền Hoạt động được cập nhật ngay.' : 'Đã từ chối lời mời.',
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
    await runSocialAction('block', () => unblockUser(client, profile.id), 'Đã bỏ chặn tài khoản. Quan hệ bạn bè cũ không được tự động khôi phục.');
  }

  async function handleReport() {
    if (!client || !profile) return;
    setBusyAction('report');
    setMessage(null);
    setErrorMessage(null);
    try {
      await createSafetyReport(client, {
        targetUserId: profile.id,
        reasonCode: reportReason,
        description: reportDescription,
      });
      setMessage('Báo cáo đã được gửi tới đội ngũ an toàn MyFan.');
      setShowReport(false);
      setReportDescription('');
      setReportReason('spam');
    } catch (error) {
      setErrorMessage(getReadableSocialError(error));
    } finally {
      setBusyAction(null);
    }
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

  const distanceLabel = profile.distance_km === null ? null : formatApproximateDistance(profile.distance_km);
  const lastActiveLabel = formatLastActive(profile.last_active_at, profile.presence_status);

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
          <View style={styles.statusRow}>
            <Text style={styles.activeBadge}>Đang hoạt động</Text>
            <Text style={[styles.presenceBadge, profile.presence_status === 'online' && styles.onlineBadge]}>
              {profile.presence_status === 'online' ? '● Online' : '○ Offline'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.profileFacts}>
        <Fact label="Tuổi" value={`${profile.age_years} tuổi`} />
        <Fact label="Hoạt động" value={lastActiveLabel} />
        <Fact label="Địa phương" value={profile.province_name ?? 'Chưa chia sẻ'} />
        <Fact label="Khoảng cách" value={distanceLabel ?? 'Không hiển thị'} />
      </View>

      {profile.blocked_by_viewer ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Bạn đã chặn tài khoản này</Text>
          <Text style={styles.bodyText}>Hoạt động, ảnh, lời mời và tương tác đang bị ẩn. Thông tin hồ sơ cơ bản vẫn được giữ để bạn nhận biết tài khoản.</Text>
          <Pressable accessibilityRole="button" disabled={busyAction !== null} onPress={handleUnblock} style={styles.primaryButton}>
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
                {profile.interests.map((interest) => <View key={interest} style={styles.chip}><Text style={styles.chipText}>{interest}</Text></View>)}
              </View>
            ) : <Text style={styles.bodyText}>Chưa chia sẻ sở thích.</Text>}
          </View>

          {profile.is_creator ? (
            <View style={styles.activitySection}>
              <View style={styles.activityHeading}>
                <View style={styles.activityHeadingCopy}>
                  <Text style={styles.sectionTitle}>Hoạt động & Album ảnh</Text>
                  <Text style={styles.activityNote}>Album lấy ảnh từ bài Hoạt động. Text, ảnh và video đều dùng cùng một quyền riêng tư.</Text>
                </View>
                {profile.activity_can_view ? <Text style={styles.activityCount}>{profile.activity_post_count} bài</Text> : null}
              </View>
              <CreatorActivityList compact username={profile.username} />
            </View>
          ) : null}

          <View style={styles.safetyActions}>
            <Pressable accessibilityRole="button" onPress={() => setShowReport(true)} style={styles.secondaryButton}>
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
          <Text style={styles.bodyText}>Hai tài khoản sẽ không thể tìm thấy nhau, kết bạn, xem Hoạt động hoặc nhắn tin.</Text>
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
          <Text style={styles.warningTitle}>Báo cáo tài khoản này</Text>
          <Text style={styles.bodyText}>Chọn lý do chính. Báo cáo riêng từng bài, ảnh hoặc link nằm trong thẻ Hoạt động tương ứng.</Text>
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
            <Pressable accessibilityRole="button" onPress={() => setShowReport(false)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Hủy</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busyAction !== null} onPress={handleReport} style={styles.primaryButtonCompact}>
              <Text style={styles.primaryButtonText}>{busyAction === 'report' ? 'Đang gửi…' : 'Gửi báo cáo'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
      {errorMessage || profileQuery.error ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage ?? 'Không thể tải đầy đủ hồ sơ. Hãy thử lại.'}</Text> : null}
    </ScrollView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;
}

function formatLastActive(value: string, status: 'online' | 'offline'): string {
  if (status === 'online') return 'Đang trực tuyến';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ngoại tuyến';
  const diff = Date.now() - date.getTime();
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} phút trước`;
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))} giờ trước`;
  return date.toLocaleDateString('vi-VN');
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
    return <View style={styles.relationshipCard}><Text style={styles.relationshipTitle}>✓ Hai bạn đã là bạn bè</Text><Text style={styles.bodyText}>Quyền xem nội dung dành cho Bạn bè được cập nhật tự động.</Text><Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onChat} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{props.busy ? 'Đang mở…' : 'Nhắn tin'}</Text></Pressable></View>;
  }
  if (props.status === 'pending' && props.direction === 'incoming') {
    return <View style={styles.relationshipCard}><Text style={styles.relationshipTitle}>Bạn có một lời mời kết bạn</Text><View style={styles.inlineActions}><Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onDecline} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Từ chối</Text></Pressable><Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onAccept} style={styles.primaryButtonCompact}><Text style={styles.primaryButtonText}>{props.busy ? 'Đang xử lý…' : 'Chấp nhận'}</Text></Pressable></View></View>;
  }
  if (props.status === 'pending') {
    return <View style={styles.relationshipCard}><Text style={styles.relationshipTitle}>Lời mời đang chờ phản hồi</Text><Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onCancel} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{props.busy ? 'Đang xử lý…' : 'Hủy lời mời'}</Text></Pressable></View>;
  }
  return <View style={styles.relationshipCard}><Text style={styles.relationshipTitle}>Kết nối an toàn</Text><TextInput accessibilityLabel="Lời chào khi gửi lời mời kết bạn" maxLength={280} multiline onChangeText={props.onGreetingChange} placeholder="Lời chào tùy chọn, tối đa 280 ký tự" style={styles.greetingInput} value={props.greeting} /><Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onSend} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{props.busy ? 'Đang gửi…' : 'Gửi lời mời kết bạn'}</Text></Pressable></View>;
}

function LoadingScreen() {
  return <View style={styles.centeredPage}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.bodyText}>Đang tải…</Text></View>;
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
  creatorBadge: { color: colors.primary, backgroundColor: '#FCE7F3', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: '900' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  activeBadge: { color: '#166534', backgroundColor: '#DCFCE7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '900' },
  presenceBadge: { color: colors.muted, backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '800' },
  onlineBadge: { color: '#166534', backgroundColor: '#DCFCE7' },
  profileFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fact: { width: '48%', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, padding: spacing.sm, gap: 3 },
  factLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  factValue: { color: colors.text, fontSize: 13, fontWeight: '900' },
  section: { marginTop: spacing.md, gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  bodyText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderRadius: 999, backgroundColor: '#F3F4F6', paddingHorizontal: 11, paddingVertical: 7 },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  activitySection: { marginTop: spacing.md, gap: spacing.md },
  activityHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  activityHeadingCopy: { flex: 1, gap: 3 },
  activityNote: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  activityCount: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  relationshipCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  relationshipTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  greetingInput: { minHeight: 82, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.sm, textAlignVertical: 'top' },
  warningCard: { borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 16, backgroundColor: '#FEF2F2', padding: spacing.md, gap: spacing.sm },
  warningTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  safetyActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  primaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary, paddingHorizontal: spacing.md },
  primaryButtonCompact: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary, paddingHorizontal: spacing.md },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  dangerButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12, backgroundColor: '#FEF2F2' },
  dangerButtonText: { color: colors.danger, fontSize: 13, fontWeight: '900' },
  confirmCard: { borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 16, backgroundColor: '#FEF2F2', padding: spacing.md, gap: spacing.sm },
  reportCard: { borderWidth: 1, borderColor: '#FDE68A', borderRadius: 16, backgroundColor: '#FFFBEB', padding: spacing.md, gap: spacing.sm },
  inlineActions: { flexDirection: 'row', gap: spacing.sm },
  dangerFilledButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.danger },
  dangerFilledText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  reasonChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 7 },
  reasonChipActive: { borderColor: colors.primary, backgroundColor: '#FCE7F3' },
  reasonText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  reasonTextActive: { color: colors.primary },
  textArea: { minHeight: 90, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, padding: spacing.sm, textAlignVertical: 'top' },
  success: { color: '#166534', backgroundColor: '#F0FDF4', borderRadius: 12, padding: spacing.md },
  error: { color: colors.danger, backgroundColor: '#FEF2F2', borderRadius: 12, padding: spacing.md },
  notFoundTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
});
