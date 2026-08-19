import {
  blockUser,
  createChatClientMessageId,
  createLuxyUpgradeIntent,
  createPublicProfileMediaUrl,
  createSafetyReport,
  getLuxyProfileConversation,
  getLuxyMemberProfile,
  getMyLuxyMembershipSnapshot,
  getProfileInterestState,
  getProfileViewer,
  getReadableChatError,
  getReadableSocialError,
  listProfileAlbumMedia,
  LUXY_LIFESTYLE_LABELS,
  REPORT_REASON_OPTIONS,
  sendChatMessage,
  unblockUser,
  type AlbumMediaItem,
  type LuxyMemberProfile,
  type ReportReasonCode,
} from '@myfan/supabase';
import { luxyBreakpoints, luxyColors, luxyRadii, luxyTypography } from '@myfan/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { ChonBrandIcon } from '@/components/chon-brand-icon';
import {
  CHON_ICON_SIZE_DESKTOP,
  CHON_ICON_SIZE_MOBILE,
  CHON_MEMBERSHIP_BADGE_WIDTH_DESKTOP,
  CHON_MEMBERSHIP_BADGE_WIDTH_MOBILE,
} from '@/components/chon-ui-sizing';
import { LuxyFavoriteButton } from '@/components/luxy-favorite-button';
import { LuxyMembershipBadgeImage } from '@/components/luxy-membership-badge-image';
import { LuxyPrivatePhotoAccess } from '@/components/luxy-private-photo-access';
import { LuxyProfilePhotoModal } from '@/components/luxy-profile-photo-modal';
import { LuxyUpgradeGateModal } from '@/components/luxy-upgrade-gate-modal';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

function normalizeUsername(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function LuxyMemberProfilePage() {
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const username = normalizeUsername(params.username).trim();
  const router = useRouter();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const desktop = width >= luxyBreakpoints.desktop;
  const profileIconSize = desktop ? CHON_ICON_SIZE_DESKTOP : CHON_ICON_SIZE_MOBILE;
  const membershipBadgeWidth = desktop
    ? CHON_MEMBERSHIP_BADGE_WIDTH_DESKTOP
    : CHON_MEMBERSHIP_BADGE_WIDTH_MOBILE;

  const [profileMessageDraft, setProfileMessageDraft] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReasonCode>('spam');
  const [reportDescription, setReportDescription] = useState('');
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['luxy-member-profile', auth.userId, username],
    enabled: Boolean(client && auth.userId && username),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getLuxyMemberProfile(client, username);
    },
  });

  const socialQuery = useQuery({
    queryKey: ['profile-viewer', auth.userId, username],
    enabled: Boolean(client && auth.userId && username),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getProfileViewer(client, username);
    },
  });

  const membershipQuery = useQuery({
    queryKey: ['luxy-membership', auth.userId],
    enabled: Boolean(client && auth.userId),
    staleTime: 20_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyLuxyMembershipSnapshot(client);
    },
  });

  const profile = profileQuery.data;
  const social = socialQuery.data;

  const interestQuery = useQuery({
    queryKey: ['profile-interest-state', profile?.id],
    enabled: Boolean(client && profile?.id && !profile?.blocked_by_viewer),
    staleTime: 20_000,
    queryFn: async () => {
      if (!client || !profile) throw new Error('profile_not_available');
      return getProfileInterestState(client, profile.id);
    },
  });

  const publicMediaQuery = useQuery({
    queryKey: ['luxy-member-profile', 'public-media', profile?.id],
    enabled: Boolean(client && profile?.id && !profile?.blocked_by_viewer),
    staleTime: 45_000,
    queryFn: async () => {
      if (!client || !profile) return [];
      return listProfileAlbumMedia(client, profile.id, 'public');
    },
  });

  const avatarQuery = useQuery({
    queryKey: ['luxy-member-profile', 'avatar', profile?.avatar_media_id],
    enabled: Boolean(client && profile?.avatar_storage_bucket && profile?.avatar_storage_path),
    staleTime: 45_000,
    queryFn: async () => {
      if (!client || !profile?.avatar_storage_bucket || !profile.avatar_storage_path) return null;
      return createPublicProfileMediaUrl(client, {
        storage_bucket: profile.avatar_storage_bucket,
        storage_path: profile.avatar_storage_path,
      });
    },
  });

  const displayName = profile?.display_name || profile?.username || 'Thành viên Chọn.Love';
  const favoriteState = interestQuery.data;
  const publicMedia = useMemo(() => publicMediaQuery.data ?? [], [publicMediaQuery.data]);

  async function refreshProfile() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['luxy-member-profile', auth.userId, username] }),
      queryClient.invalidateQueries({ queryKey: ['profile-viewer', auth.userId, username] }),
      queryClient.invalidateQueries({ queryKey: ['social-connections', auth.userId] }),
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations', auth.userId] }),
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

  async function handleMessageAction(draft = '') {
    if (!client || !profile || profile.blocked_by_viewer) return;
    setMessage(null);
    setErrorMessage(null);

    if (!membershipQuery.data?.can_message) {
      setShowUpgrade(true);
      return;
    }

    setBusyAction('chat');
    try {
      const conversationId = await getLuxyProfileConversation(client, profile.id);
      if (!conversationId) throw new Error('conversation_not_available');
      const body = draft.trim();
      if (body) {
        await sendChatMessage(client, {
          conversationId,
          body,
          clientMessageId: createChatClientMessageId(),
        });
      }
      setPhotoOpen(false);
      router.push({ pathname: '/chat/[conversationId]', params: { conversationId } });
    } catch (error) {
      const readable = getReadableChatError(error);
      setErrorMessage(readable);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpgrade() {
    if (!client) return;
    setUpgradeBusy(true);
    try {
      await createLuxyUpgradeIntent(client, 'premium', 'member_profile_message');
      setShowUpgrade(false);
      router.push({ pathname: '/settings/membership', params: { plan: 'premium', source: 'member_profile_message' } });
    } catch {
      setErrorMessage('Không thể mở luồng nâng cấp lúc này. Vui lòng thử lại.');
    } finally {
      setUpgradeBusy(false);
    }
  }

  async function handleBlock() {
    if (!client || !profile) return;
    await runSocialAction('block', () => blockUser(client, profile.id, 'profile_safety'), 'Đã chặn tài khoản.');
    setShowBlockConfirm(false);
    setShowMoreMenu(false);
  }

  async function handleUnblock() {
    if (!client || !profile) return;
    await runSocialAction('block', () => unblockUser(client, profile.id), 'Đã bỏ chặn tài khoản. Quan hệ kết nối cũ không được tự động khôi phục.');
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
      setMessage('Báo cáo đã được gửi tới đội ngũ an toàn Chon.Love.');
      setShowReport(false);
      setReportDescription('');
      setReportReason('spam');
    } catch (error) {
      setErrorMessage(getReadableSocialError(error));
    } finally {
      setBusyAction(null);
    }
  }

  function openPhoto(url: string | null) {
    setSelectedPhotoUrl(url);
    setPhotoOpen(true);
  }

  if (profileQuery.isLoading || socialQuery.isLoading) return <LoadingScreen />;

  if (!username || !profile || !social) {
    return (
      <View style={styles.centeredPage}>
        <Text accessibilityRole="header" style={styles.notFoundTitle}>Không tìm thấy hồ sơ</Text>
        <Text style={styles.mutedText}>Hồ sơ không tồn tại, không còn hoạt động hoặc bạn không có quyền xem.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.outlineButton}>
          <Text style={styles.outlineButtonText}>Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.pageContent} style={styles.page} testID="luxy-member-profile-page">
      <View style={[styles.profileFrame, desktop ? styles.profileFrameDesktop : styles.profileFrameMobile]}>
        <View style={[styles.leftColumn, desktop && styles.leftColumnDesktop]}>
          <View style={styles.heroPhotoFrame} testID="luxy-member-profile-hero-photo">
            <Pressable
              accessibilityLabel={`Xem ảnh đại diện của ${displayName}`}
              accessibilityRole="button"
              disabled={!avatarQuery.data}
              onPress={() => openPhoto(avatarQuery.data ?? null)}
              style={({ pressed }) => [styles.heroPhotoPressTarget, pressed && styles.pressed]}
            >
              {avatarQuery.data ? (
                <Image accessibilityLabel={`Ảnh đại diện của ${displayName}`} resizeMode="cover" source={{ uri: avatarQuery.data }} style={styles.heroPhoto} />
              ) : (
                <View style={styles.heroFallback}><Text style={styles.heroFallbackText}>{displayName.slice(0, 1).toUpperCase()}</Text></View>
              )}
            </Pressable>
            {profile.membership_badge_visible ? (
              <LuxyMembershipBadgeImage tier={profile.membership_tier} width={membershipBadgeWidth} inset={10} />
            ) : null}
            {!profile.blocked_by_viewer ? (
              <View style={styles.heroFavorite}>
                <LuxyFavoriteButton
                  initialFavorited={favoriteState?.is_favorited ?? false}
                  initialFavoritedBy={favoriteState?.is_favorited_by ?? false}
                  name={displayName}
                  profileId={profile.id}
                />
              </View>
            ) : null}
          </View>

          {profile.private_photo_count > 0 && !profile.blocked_by_viewer ? (
            <LuxyPrivatePhotoAccess
              displayName={displayName}
              onOpenPhoto={openPhoto}
              ownerId={profile.id}
              privatePhotoCount={profile.private_photo_count}
              variant="button"
            />
          ) : null}

          <ProfileFacts iconSize={profileIconSize} profile={profile} />
          <View style={styles.memberSinceRow} testID="luxy-profile-fact-member-since">
            <ChonBrandIcon name="profile" size={profileIconSize} />
            <Text style={styles.factLabelStrong}>Thành viên từ</Text>
            <Text style={styles.memberSinceValue}>{formatMemberSince(profile.member_since)}</Text>
          </View>

          <Pressable accessibilityRole="button" disabled style={styles.notesButton}>
            <Text style={styles.notesButtonText}>Ghi chú thành viên</Text>
          </Pressable>
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.identityHeader}>
            <View style={styles.identityCopy}>
              <View style={styles.nameLine}>
                <Text accessibilityRole="header" style={styles.displayName}>{displayName}, {profile.age}</Text>
              </View>
              <Text style={styles.locationText}>{profile.province_name ?? 'Việt Nam'}</Text>
              <Text style={styles.headline}>{profile.headline || interestedInSentence(profile)}</Text>
            </View>
            <View style={styles.moreWrap}>
              <Pressable accessibilityLabel="Tùy chọn hồ sơ" accessibilityRole="button" onPress={() => setShowMoreMenu((value) => !value)} style={styles.moreButton}>
                <Text style={styles.moreText}>•••</Text>
              </Pressable>
              {showMoreMenu ? (
                <View style={styles.moreMenu}>
                  {profile.blocked_by_viewer ? (
                    <Pressable accessibilityRole="button" onPress={() => void handleUnblock()} style={styles.moreMenuItem}><Text style={styles.moreMenuText}>Bỏ chặn</Text></Pressable>
                  ) : (
                    <>
                      <Pressable accessibilityRole="button" onPress={() => { setShowReport(true); setShowMoreMenu(false); }} style={styles.moreMenuItem}><Text style={styles.moreMenuText}>Báo cáo tài khoản</Text></Pressable>
                      <Pressable accessibilityRole="button" onPress={() => { setShowBlockConfirm(true); setShowMoreMenu(false); }} style={styles.moreMenuItem}><Text style={styles.moreMenuDanger}>Chặn</Text></Pressable>
                    </>
                  )}
                </View>
              ) : null}
            </View>
          </View>

          {profile.blocked_by_viewer ? (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>Bạn đã chặn tài khoản này</Text>
              <Text style={styles.mutedText}>Ảnh, yêu thích và nhắn tin đang bị ẩn.</Text>
              <Pressable accessibilityRole="button" onPress={() => void handleUnblock()} style={styles.darkButton}><Text style={styles.darkButtonText}>Bỏ chặn</Text></Pressable>
            </View>
          ) : (
            <>
              <View style={styles.messageComposer} testID="luxy-member-profile-message-composer">
                <TextInput
                  accessibilityLabel={`Nội dung tin nhắn cho ${displayName}`}
                  maxLength={500}
                  multiline
                  onChangeText={setProfileMessageDraft}
                  placeholder={`Nhắn tin cho ${displayName}`}
                  placeholderTextColor={luxyColors.softMuted}
                  style={styles.profileMessageInput}
                  value={profileMessageDraft}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={busyAction === 'chat'}
                  onPress={() => void handleMessageAction(profileMessageDraft)}
                  style={({ pressed }) => [styles.messageButton, pressed && styles.pressed]}
                  testID="luxy-member-profile-message-button"
                >
                  <Text style={styles.messageButtonText}>{busyAction === 'chat' ? 'Đang mở…' : 'Nhắn tin'}</Text>
                </Pressable>
              </View>

              <View style={styles.photoGrid} testID="luxy-member-profile-photo-grid">
                {publicMedia.map((media) => (
                  <ProfilePhotoTile key={media.media_id} media={media} name={displayName} onOpen={openPhoto} />
                ))}
                {profile.private_photo_count > 0 ? (
                  <LuxyPrivatePhotoAccess
                    displayName={displayName}
                    onOpenPhoto={openPhoto}
                    ownerId={profile.id}
                    privatePhotoCount={profile.private_photo_count}
                    variant="tile"
                  />
                ) : null}
              </View>

              <ProfileStorySection profile={profile} />
            </>
          )}

          {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
          {errorMessage || profileQuery.error || socialQuery.error ? (
            <Text accessibilityRole="alert" style={styles.error}>{errorMessage ?? 'Không thể tải đầy đủ hồ sơ. Hãy thử lại.'}</Text>
          ) : null}
        </View>
      </View>

      <LuxyProfilePhotoModal
        age={profile.age}
        imageUrl={selectedPhotoUrl}
        initialFavorited={favoriteState?.is_favorited ?? false}
        initialFavoritedBy={favoriteState?.is_favorited_by ?? false}
        name={displayName}
        onClose={() => setPhotoOpen(false)}
        onMessage={(draft) => void handleMessageAction(draft)}
        profileId={profile.id}
        visible={photoOpen}
      />
      <LuxyUpgradeGateModal busy={upgradeBusy} onClose={() => setShowUpgrade(false)} onUpgrade={() => void handleUpgrade()} reason="message" visible={showUpgrade} />
      <SafetyModal
        busyAction={busyAction}
        displayName={displayName}
        mode={showBlockConfirm ? 'block' : showReport ? 'report' : null}
        onBlock={() => void handleBlock()}
        onClose={() => { setShowBlockConfirm(false); setShowReport(false); }}
        onDescriptionChange={setReportDescription}
        onReasonChange={setReportReason}
        onReport={() => void handleReport()}
        reason={reportReason}
        reportDescription={reportDescription}
      />
    </ScrollView>
  );
}

function ProfilePhotoTile({ media, name, onOpen }: { media: AlbumMediaItem; name: string; onOpen: (url: string | null) => void }) {
  const client = getMobileSupabaseClient();
  const imageQuery = useQuery({
    queryKey: ['luxy-member-profile', 'photo-url', media.media_id],
    enabled: Boolean(client),
    staleTime: 40_000,
    queryFn: async () => {
      if (!client) return null;
      return createPublicProfileMediaUrl(client, media);
    },
  });
  return (
    <Pressable accessibilityLabel={`Xem ảnh của ${name}`} accessibilityRole="button" onPress={() => onOpen(imageQuery.data ?? null)} style={({ pressed }) => [styles.photoTile, pressed && styles.pressed]} testID="luxy-member-profile-photo-tile">
      {imageQuery.data ? <Image accessibilityLabel={`Ảnh của ${name}`} resizeMode="cover" source={{ uri: imageQuery.data }} style={styles.photoTileImage} /> : <View style={styles.photoTileFallback}><ActivityIndicator color={luxyColors.ink} /></View>}
      <View style={styles.photoHeart}><Text style={styles.photoHeartText}>♡</Text></View>
    </Pressable>
  );
}

function ProfileFacts({ profile, iconSize }: { profile: LuxyMemberProfile; iconSize: number }) {
  return (
    <View style={styles.factList}>
      {profile.height_cm ? (
        <View style={styles.factRow} testID="luxy-profile-fact-height">
          <Text style={styles.profileFactLabel}>Chiều cao</Text>
          <Text style={styles.factText}>{profile.height_cm} cm</Text>
        </View>
      ) : null}
      {profile.weight_kg ? (
        <View style={styles.factRow} testID="luxy-profile-fact-weight">
          <Text style={styles.profileFactLabel}>Cân nặng</Text>
          <Text style={styles.factText}>{profile.weight_kg} kg</Text>
        </View>
      ) : null}
      <View style={styles.factRow} testID="luxy-profile-fact-relationship">
        <Text style={styles.profileFactLabel}>Tình trạng</Text>
        <Text style={styles.factText}>{relationshipLabel(profile.relationship_status)}</Text>
      </View>
      <View style={styles.factRow} testID="luxy-profile-fact-recent">
        <ChonBrandIcon name="recent" size={iconSize} />
        <Text style={styles.factText}>{formatLastActive(profile.last_active_at)}</Text>
      </View>
      <View style={styles.factRow} testID="luxy-profile-fact-location">
        <ChonBrandIcon name="location" size={iconSize} />
        <Text style={styles.factText}>{profile.province_name ?? 'Việt Nam'}</Text>
      </View>
    </View>
  );
}

function ProfileStorySection({ profile }: { profile: LuxyMemberProfile }) {
  const details = [
    ['Giới tính', genderLabel(profile.gender)],
    ['Con cái', childrenLabel(profile.children_status)],
    ['Học vấn', educationLabel(profile.education_level)],
    ['Hút thuốc', smokingLabel(profile.smoking_status)],
    ['Đồ uống', drinkingLabel(profile.drinking_status)],
    ['Nghề nghiệp', profile.occupation || 'Chưa chia sẻ'],
  ] as const;
  return (
    <View style={styles.storyWrap}>
      <View style={styles.storySection}>
        <Text style={styles.sectionTitle}>Về tôi</Text>
        <Text style={styles.storyText}>{profile.bio || 'Chưa có phần giới thiệu.'}</Text>
        {profile.languages.length ? <Text style={styles.storyMeta}>Ngôn ngữ: {profile.languages.join(' · ')}</Text> : null}
        {profile.interests.length ? <Text style={styles.storyMeta}>Sở thích: {profile.interests.join(' · ')}</Text> : null}
      </View>
      <View style={styles.storySection}>
        <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Tôi đang tìm kiếm</Text><Text style={styles.interestedIn}>{interestedInLabel(profile.interested_in)}</Text></View>
        <Text style={styles.storyText}>{profile.looking_for || 'Một kết nối chất lượng, tôn trọng và có chủ đích.'}</Text>
        {profile.lifestyle_tags.length ? <View style={styles.tagRow}>{profile.lifestyle_tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{LUXY_LIFESTYLE_LABELS[tag]}</Text></View>)}</View> : null}
      </View>
      <View style={styles.detailGrid}>{details.map(([label, value]) => <View key={label} style={styles.detailItem}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>)}</View>
    </View>
  );
}

function SafetyModal(props: {
  mode: 'block' | 'report' | null;
  displayName: string;
  busyAction: string | null;
  reason: ReportReasonCode;
  reportDescription: string;
  onReasonChange: (reason: ReportReasonCode) => void;
  onDescriptionChange: (value: string) => void;
  onClose: () => void;
  onBlock: () => void;
  onReport: () => void;
}) {
  return <Modal animationType="fade" onRequestClose={props.onClose} transparent visible={props.mode !== null}><View style={styles.safetyBackdrop}><Pressable accessibilityLabel="Đóng" accessibilityRole="button" onPress={props.onClose} style={styles.safetyDismiss} /><View style={styles.safetyCard}>{props.mode === 'block' ? <><Text accessibilityRole="header" style={styles.safetyTitle}>Chặn {props.displayName}?</Text><Text style={styles.mutedText}>Hai tài khoản sẽ không thể tìm thấy nhau, xem hồ sơ hoặc gửi tin nhắn.</Text><View style={styles.inlineActions}><Pressable accessibilityRole="button" onPress={props.onClose} style={styles.smallOutline}><Text style={styles.smallOutlineText}>Hủy</Text></Pressable><Pressable accessibilityRole="button" disabled={props.busyAction !== null} onPress={props.onBlock} style={styles.dangerFilled}><Text style={styles.dangerFilledText}>Xác nhận chặn</Text></Pressable></View></> : <><Text accessibilityRole="header" style={styles.safetyTitle}>Báo cáo tài khoản</Text><View style={styles.reasonWrap}>{REPORT_REASON_OPTIONS.map((reason) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: props.reason === reason.code }} key={reason.code} onPress={() => props.onReasonChange(reason.code)} style={[styles.reasonChip, props.reason === reason.code && styles.reasonChipActive]}><Text style={styles.reasonText}>{reason.label}</Text></Pressable>)}</View><TextInput accessibilityLabel="Mô tả bổ sung cho báo cáo" maxLength={1000} multiline onChangeText={props.onDescriptionChange} placeholder="Mô tả ngắn sự việc" placeholderTextColor={luxyColors.softMuted} style={styles.reportInput} value={props.reportDescription} /><View style={styles.inlineActions}><Pressable accessibilityRole="button" onPress={props.onClose} style={styles.smallOutline}><Text style={styles.smallOutlineText}>Hủy</Text></Pressable><Pressable accessibilityRole="button" disabled={props.busyAction !== null} onPress={props.onReport} style={styles.smallDark}><Text style={styles.smallDarkText}>{props.busyAction === 'report' ? 'Đang gửi…' : 'Gửi báo cáo'}</Text></Pressable></View></>}</View></View></Modal>;
}

function LoadingScreen() { return <View style={styles.centeredPage}><ActivityIndicator color={luxyColors.ink} size="large" /><Text style={styles.mutedText}>Đang tải hồ sơ…</Text></View>; }
function formatLastActive(value: string | null): string { if (!value) return 'Truy cập gần đây'; const date = new Date(value); if (Number.isNaN(date.getTime())) return 'Truy cập gần đây'; const diff = Date.now() - date.getTime(); if (diff < 15 * 60_000) return 'Đang online'; if (diff < 3_600_000) return `Truy cập ${Math.max(1, Math.floor(diff / 60_000))} phút trước`; if (diff < 86_400_000) return `Truy cập ${Math.max(1, Math.floor(diff / 3_600_000))} giờ trước`; return `Truy cập ${Math.max(1, Math.floor(diff / 86_400_000))} ngày trước`; }
function formatMemberSince(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Chọn.Love' : date.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }); }
function interestedInSentence(profile: LuxyMemberProfile): string { return `Đang tìm ${interestedInLabel(profile.interested_in).toLowerCase()} cho một kết nối chất lượng`; }
function interestedInLabel(value: LuxyMemberProfile['interested_in']): string { return value === 'female' ? 'Nữ' : value === 'male' ? 'Nam' : 'Nam / Nữ'; }
function genderLabel(value: LuxyMemberProfile['gender']): string { return value === 'female' ? 'Nữ' : value === 'male' ? 'Nam' : value === 'non_binary' ? 'Phi nhị nguyên' : value === 'other' ? 'Khác' : 'Chưa chia sẻ'; }
function relationshipLabel(value: LuxyMemberProfile['relationship_status']): string { return ({ single: 'Độc thân', divorced: 'Đã ly hôn', widowed: 'Goá', open: 'Quan hệ mở', complicated: 'Phức tạp', prefer_not_to_say: 'Chưa chia sẻ' } as const)[value]; }
function childrenLabel(value: LuxyMemberProfile['children_status']): string { return value === 'no_children' ? 'Chưa có con' : value === 'has_children' ? 'Đã có con' : 'Chưa chia sẻ'; }
function smokingLabel(value: LuxyMemberProfile['smoking_status']): string { return ({ never: 'Không hút thuốc', socially: 'Hút xã giao', regularly: 'Hút thường xuyên', trying_to_quit: 'Đang cố bỏ', prefer_not_to_say: 'Chưa chia sẻ' } as const)[value]; }
function drinkingLabel(value: LuxyMemberProfile['drinking_status']): string { return ({ never: 'Không uống', socially: 'Uống xã giao', regularly: 'Uống thường xuyên', prefer_not_to_say: 'Chưa chia sẻ' } as const)[value]; }
function educationLabel(value: LuxyMemberProfile['education_level']): string { return ({ high_school: 'THPT', vocational: 'Trung cấp / nghề', college: 'Cao đẳng', bachelors: 'Đại học', masters: 'Thạc sĩ', doctorate: 'Tiến sĩ', other: 'Khác', prefer_not_to_say: 'Chưa chia sẻ' } as const)[value]; }

const styles = StyleSheet.create({
  page: { backgroundColor: luxyColors.surface, flex: 1 }, pageContent: { paddingBottom: 80 }, profileFrame: { alignSelf: 'center', maxWidth: 1440, width: '100%' }, profileFrameDesktop: { alignItems: 'flex-start', flexDirection: 'row', gap: 20, paddingHorizontal: 12, paddingTop: 24 }, profileFrameMobile: { gap: 16, paddingHorizontal: 10, paddingTop: 12 },
  leftColumn: { width: '100%' }, leftColumnDesktop: { flexBasis: 330, flexGrow: 0, flexShrink: 0, width: 330 }, rightColumn: { flex: 1, minWidth: 0 },
  heroPhotoFrame: { aspectRatio: 0.72, backgroundColor: '#E7E5E4', borderRadius: 14, overflow: 'hidden', position: 'relative', width: '100%' }, heroPhotoPressTarget: { height: '100%', width: '100%' }, heroPhoto: { height: '100%', width: '100%' }, heroFallback: { alignItems: 'center', height: '100%', justifyContent: 'center', width: '100%' }, heroFallbackText: { color: luxyColors.muted, fontFamily: luxyTypography.families.display, fontSize: 70 }, heroFavorite: { bottom: 10, position: 'absolute', right: 10 },
  privateRequestButton: { alignItems: 'center', borderColor: luxyColors.ink, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', marginTop: 8, minHeight: 44, paddingHorizontal: 12 }, privateRequestText: { color: luxyColors.text, fontSize: 12, fontWeight: '600' },
  factList: { borderBottomColor: luxyColors.border, borderBottomWidth: 1, gap: 12, paddingHorizontal: 12, paddingVertical: 18 }, factRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 20 }, factText: { color: luxyColors.text, flexShrink: 1, fontSize: 12, lineHeight: 18 }, profileFactLabel: { color: luxyColors.muted, fontSize: 11, fontWeight: '600', minWidth: 76 }, memberSinceRow: { alignItems: 'center', borderBottomColor: luxyColors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 8, minHeight: 52, paddingHorizontal: 12 }, factLabelStrong: { color: luxyColors.text, flex: 1, fontSize: 11, fontWeight: '700' }, memberSinceValue: { color: luxyColors.muted, fontSize: 11 },
  notesButton: { alignItems: 'center', borderColor: luxyColors.borderStrong, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', marginTop: 18, minHeight: 44, opacity: 0.55 }, notesButtonText: { color: luxyColors.text, fontSize: 11 },
  identityHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', minHeight: 92, paddingBottom: 14 }, identityCopy: { flex: 1, minWidth: 0, paddingRight: 12 }, nameLine: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, displayName: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 29, fontWeight: '400', lineHeight: 35 }, locationText: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 18, lineHeight: 23 }, headline: { color: luxyColors.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  moreWrap: { position: 'relative', zIndex: 20 }, moreButton: { alignItems: 'center', borderColor: luxyColors.border, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 }, moreText: { color: luxyColors.muted, fontSize: 18, letterSpacing: 1 }, moreMenu: { backgroundColor: luxyColors.surface, borderColor: luxyColors.border, borderRadius: luxyRadii.sm, borderWidth: 1, minWidth: 180, position: 'absolute', right: 0, top: 48, zIndex: 30 }, moreMenuItem: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 }, moreMenuText: { color: luxyColors.text, fontSize: 12 }, moreMenuDanger: { color: luxyColors.danger, fontSize: 12 },
  messageComposer: { backgroundColor: '#FAFAFA', gap: 12, marginBottom: 14, padding: 14 }, profileMessageInput: { backgroundColor: '#F2F2F2', borderColor: luxyColors.border, borderWidth: 1, color: luxyColors.text, fontSize: 13, minHeight: 90, padding: 12, textAlignVertical: 'top' }, messageButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: luxyColors.ink, borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 46, minWidth: 250, paddingHorizontal: 28 }, messageButtonText: { color: luxyColors.surface, fontSize: 12, fontWeight: '600' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }, photoTile: { aspectRatio: 0.8, backgroundColor: '#E7E5E4', borderRadius: 9, flexBasis: '23.8%', flexGrow: 1, maxWidth: '24%', minWidth: 120, overflow: 'hidden', position: 'relative' }, photoTileImage: { height: '100%', width: '100%' }, photoTileFallback: { alignItems: 'center', height: '100%', justifyContent: 'center', width: '100%' }, photoHeart: { alignItems: 'center', backgroundColor: 'rgba(8,23,38,0.52)', borderRadius: 17, bottom: 6, height: 34, justifyContent: 'center', position: 'absolute', right: 6, width: 34 }, photoHeartText: { color: luxyColors.surface, fontSize: 20 },
  privateTile: { alignItems: 'center', aspectRatio: 0.8, backgroundColor: luxyColors.ink, borderRadius: 9, flexBasis: '23.8%', flexGrow: 1, justifyContent: 'center', maxWidth: '24%', minWidth: 120, padding: 10 }, privateEye: { color: luxyColors.surface, fontSize: 30 }, privateTileTitle: { color: luxyColors.surface, fontSize: 11, marginTop: 10, textAlign: 'center' }, privateTileButton: { backgroundColor: luxyColors.surface, borderRadius: luxyRadii.pill, color: luxyColors.ink, fontSize: 10, fontWeight: '700', marginTop: 12, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 9 },
  storyWrap: { gap: 32 }, storySection: { gap: 10, paddingHorizontal: 16 }, sectionTitle: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 22, fontWeight: '400', lineHeight: 28 }, storyText: { color: luxyColors.text, fontSize: 12, lineHeight: 19, maxWidth: 880 }, storyMeta: { color: luxyColors.muted, fontSize: 11, lineHeight: 17 }, sectionHeadingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, interestedIn: { color: luxyColors.muted, fontFamily: luxyTypography.families.display, fontSize: 18 }, tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, tag: { backgroundColor: '#E8E8E8', borderRadius: 3, paddingHorizontal: 10, paddingVertical: 6 }, tagText: { color: luxyColors.text, fontSize: 10 }, detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 20, paddingHorizontal: 16 }, detailItem: { flexBasis: '47%', minWidth: 180 }, detailLabel: { color: luxyColors.softMuted, fontSize: 10 }, detailValue: { color: luxyColors.text, fontSize: 11, marginTop: 2 },
  inlineActions: { flexDirection: 'row', gap: 8, marginTop: 8 }, smallOutline: { alignItems: 'center', borderColor: luxyColors.ink, borderRadius: luxyRadii.pill, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: 12 }, smallOutlineText: { color: luxyColors.text, fontSize: 11, fontWeight: '600' }, smallDark: { alignItems: 'center', backgroundColor: luxyColors.ink, borderRadius: luxyRadii.pill, flex: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: 12 }, smallDarkText: { color: luxyColors.surface, fontSize: 11, fontWeight: '600' },
  warningCard: { backgroundColor: '#FFF7ED', borderColor: '#FDBA74', borderRadius: luxyRadii.md, borderWidth: 1, gap: 10, padding: 16 }, warningTitle: { color: luxyColors.text, fontSize: 15, fontWeight: '700' }, darkButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: luxyColors.ink, borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 44, paddingHorizontal: 22 }, darkButtonText: { color: luxyColors.surface, fontSize: 12, fontWeight: '600' },
  centeredPage: { alignItems: 'center', backgroundColor: luxyColors.background, flex: 1, gap: 14, justifyContent: 'center', padding: 24 }, notFoundTitle: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 26 }, mutedText: { color: luxyColors.muted, fontSize: 12, lineHeight: 18 }, outlineButton: { alignItems: 'center', borderColor: luxyColors.ink, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 22 }, outlineButtonText: { color: luxyColors.text, fontSize: 12, fontWeight: '600' }, success: { color: '#166534', fontSize: 12, marginHorizontal: 16, marginTop: 18 }, error: { color: luxyColors.danger, fontSize: 12, marginHorizontal: 16, marginTop: 18 },
  safetyBackdrop: { alignItems: 'center', backgroundColor: 'rgba(8,23,38,0.72)', flex: 1, justifyContent: 'center', padding: 16 }, safetyDismiss: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }, safetyCard: { backgroundColor: luxyColors.surface, borderRadius: 14, gap: 14, maxWidth: 460, padding: 22, width: '100%' }, safetyTitle: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 23 }, reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, reasonChip: { borderColor: luxyColors.border, borderRadius: luxyRadii.pill, borderWidth: 1, minHeight: 36, paddingHorizontal: 10, paddingVertical: 8 }, reasonChipActive: { backgroundColor: luxyColors.elevatedSubtle, borderColor: luxyColors.ink }, reasonText: { color: luxyColors.text, fontSize: 10 }, reportInput: { borderColor: luxyColors.border, borderRadius: luxyRadii.sm, borderWidth: 1, color: luxyColors.text, minHeight: 90, padding: 10, textAlignVertical: 'top' }, dangerFilled: { alignItems: 'center', backgroundColor: luxyColors.danger, borderRadius: luxyRadii.pill, flex: 1, justifyContent: 'center', minHeight: 42 }, dangerFilledText: { color: luxyColors.surface, fontSize: 11, fontWeight: '700' }, pressed: { opacity: 0.8 },
});
