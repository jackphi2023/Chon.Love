import {
  blockUser,
  createChatClientMessageId,
  createLuxyUpgradeIntent,
  createPublicProfileMediaUrl,
  createSafetyReport,
  getLuxyMemberProfile,
  getLuxyProfileConversation,
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
import {
  chonBreakpoints,
  chonColors,
  chonLayout,
  chonShadows,
  chonTypography,
} from '@myfan/ui';
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
import { ChonFavoriteButton } from '@/components/chon-favorite-button';
import { ChonMemberPhoto } from '@/components/chon-member-photo';
import { ChonPrivatePhotoAccess } from '@/components/chon-private-photo-access';
import { LuxyProfilePhotoModal } from '@/components/luxy-profile-photo-modal';
import { LuxyUpgradeGateModal } from '@/components/luxy-upgrade-gate-modal';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

function normalizeUsername(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function ChonMemberProfileScreen() {
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const username = normalizeUsername(params.username).trim();
  const router = useRouter();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const desktop = width >= chonBreakpoints.desktop;

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
  const displayName = profile?.display_name || profile?.username || 'Thành viên Chọn.Love';

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
      setErrorMessage(getReadableChatError(error));
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
      setMessage('Báo cáo đã được gửi tới đội ngũ an toàn Chọn.Love.');
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
    <ScrollView contentContainerStyle={styles.pageContent} style={styles.page} testID="chon-member-profile-page">
      <View style={[styles.profileFrame, desktop ? styles.profileFrameDesktop : styles.profileFrameMobile]}>
        <View style={[styles.leftColumn, desktop && styles.leftColumnDesktop]}>
          <View style={styles.heroPhotoFrame} testID="chon-member-profile-hero-photo">
            <ChonMemberPhoto
              desktop={desktop}
              mediaId={profile.avatar_media_id}
              membershipTier={profile.membership_badge_visible ? profile.membership_tier : null}
              name={displayName}
              photoCount={profile.public_photo_count + profile.private_photo_count}
              storageBucket={profile.avatar_storage_bucket}
              storagePath={profile.avatar_storage_path}
              style={styles.heroPhoto}
              testID="chon-member-profile-hero-media"
            />
            <Pressable
              accessibilityLabel={`Xem ảnh đại diện của ${displayName}`}
              accessibilityRole="button"
              disabled={!avatarQuery.data}
              onPress={() => openPhoto(avatarQuery.data ?? null)}
              style={({ pressed }) => [styles.heroPhotoPressTarget, pressed && styles.pressed]}
            />
            {!profile.blocked_by_viewer ? (
              <View style={styles.heroFavorite}>
                <ChonFavoriteButton
                  initialFavorited={favoriteState?.is_favorited ?? false}
                  initialFavoritedBy={favoriteState?.is_favorited_by ?? false}
                  name={displayName}
                  profileId={profile.id}
                />
              </View>
            ) : null}
          </View>

          {profile.private_photo_count > 0 && !profile.blocked_by_viewer ? (
            <View style={styles.privateActionWrap}>
              <ChonPrivatePhotoAccess
                displayName={displayName}
                onOpenPhoto={openPhoto}
                ownerId={profile.id}
                privatePhotoCount={profile.private_photo_count}
                variant="button"
              />
            </View>
          ) : null}

          <View style={styles.sideMeta}>
            <SideMetaRow icon="recent" label={formatLastActive(profile.last_active_at)} testID="chon-profile-fact-recent" />
            <SideMetaRow icon="location" label={profile.province_name ?? 'Việt Nam'} testID="chon-profile-fact-location" />
            <SideMetaRow icon="profile" label={`Thành viên từ ${formatMemberSince(profile.member_since)}`} testID="chon-profile-fact-member-since" />
          </View>
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.identityHeader}>
            <View style={styles.identityCopy}>
              <Text accessibilityRole="header" style={[styles.displayName, !desktop && styles.displayNameMobile]}>{displayName}, {profile.age}</Text>
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
              <Pressable accessibilityRole="button" onPress={() => void handleUnblock()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Bỏ chặn</Text></Pressable>
            </View>
          ) : (
            <>
              <View style={styles.messageComposer} testID="chon-member-profile-message-composer">
                <TextInput
                  accessibilityLabel={`Nội dung tin nhắn cho ${displayName}`}
                  maxLength={500}
                  multiline
                  onChangeText={setProfileMessageDraft}
                  placeholder={`Nhắn tin cho ${displayName}`}
                  placeholderTextColor={chonColors.softMuted}
                  style={styles.profileMessageInput}
                  value={profileMessageDraft}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={busyAction === 'chat'}
                  onPress={() => void handleMessageAction(profileMessageDraft)}
                  style={({ pressed }) => [styles.messageButton, pressed && styles.pressed]}
                  testID="chon-member-profile-message-button"
                >
                  <Text style={styles.messageButtonText}>{busyAction === 'chat' ? 'Đang mở…' : 'Nhắn tin'}</Text>
                </Pressable>
              </View>

              <ProfileGallery
                desktop={desktop}
                displayName={displayName}
                onOpenPhoto={openPhoto}
                ownerId={profile.id}
                privatePhotoCount={profile.private_photo_count}
                publicMedia={publicMedia}
              />

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

function SideMetaRow({ icon, label, testID }: { icon: 'recent' | 'location' | 'profile'; label: string; testID: string }) {
  return <View style={styles.sideMetaRow} testID={testID}><ChonBrandIcon name={icon} size={20} /><Text style={styles.sideMetaText}>{label}</Text></View>;
}

function ProfileGallery({
  desktop,
  displayName,
  ownerId,
  privatePhotoCount,
  publicMedia,
  onOpenPhoto,
}: {
  desktop: boolean;
  displayName: string;
  ownerId: string;
  privatePhotoCount: number;
  publicMedia: AlbumMediaItem[];
  onOpenPhoto: (url: string | null) => void;
}) {
  const content = (
    <>
      {publicMedia.map((media) => <ProfilePhotoTile desktop={desktop} key={media.media_id} media={media} name={displayName} onOpen={onOpenPhoto} />)}
      {privatePhotoCount > 0 ? (
        <ChonPrivatePhotoAccess displayName={displayName} onOpenPhoto={onOpenPhoto} ownerId={ownerId} privatePhotoCount={privatePhotoCount} variant="tile" />
      ) : null}
    </>
  );
  return desktop ? (
    <View style={styles.galleryDesktop} testID="chon-member-profile-photo-grid">{content}</View>
  ) : (
    <ScrollView contentContainerStyle={styles.galleryMobileContent} horizontal showsHorizontalScrollIndicator={false} style={styles.galleryMobile} testID="chon-member-profile-photo-strip">
      {content}
    </ScrollView>
  );
}

function ProfilePhotoTile({ media, name, onOpen, desktop }: { media: AlbumMediaItem; name: string; onOpen: (url: string | null) => void; desktop: boolean }) {
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
    <Pressable accessibilityLabel={`Xem ảnh của ${name}`} accessibilityRole="button" onPress={() => onOpen(imageQuery.data ?? null)} style={({ pressed }) => [styles.photoTile, desktop && styles.photoTileDesktop, pressed && styles.pressed]} testID="chon-member-profile-photo-tile">
      {imageQuery.data ? <Image accessibilityLabel={`Ảnh của ${name}`} resizeMode="cover" source={{ uri: imageQuery.data }} style={styles.photoTileImage} /> : <View style={styles.photoTileFallback}><ActivityIndicator color={chonColors.ink} /></View>}
      <View style={styles.photoHeart}><ChonBrandIcon name="favorite" size={18} /></View>
    </Pressable>
  );
}

function ProfileStorySection({ profile }: { profile: LuxyMemberProfile }) {
  const details = [
    ['Chiều cao', profile.height_cm ? `${profile.height_cm} cm` : 'Chưa chia sẻ'],
    ['Cân nặng', profile.weight_kg ? `${profile.weight_kg} kg` : 'Chưa chia sẻ'],
    ['Tình trạng mối quan hệ', relationshipLabel(profile.relationship_status)],
    ['Giới tính', genderLabel(profile.gender)],
    ['Con cái', childrenLabel(profile.children_status)],
    ['Học vấn', educationLabel(profile.education_level)],
    ['Hút thuốc', smokingLabel(profile.smoking_status)],
    ['Uống rượu bia', drinkingLabel(profile.drinking_status)],
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
        {profile.lifestyle_tags.length ? (
          <View style={styles.tagRow}>{profile.lifestyle_tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{LUXY_LIFESTYLE_LABELS[tag]}</Text></View>)}</View>
        ) : null}
      </View>
      <View style={styles.infoList} testID="chon-member-profile-info-list">
        {details.map(([label, value]) => <ProfileInfoRow key={label} label={label} value={value} />)}
      </View>
    </View>
  );
}

function ProfileInfoRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
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
  return (
    <Modal animationType="fade" onRequestClose={props.onClose} transparent visible={props.mode !== null}>
      <View style={styles.safetyBackdrop}>
        <Pressable accessibilityLabel="Đóng" accessibilityRole="button" onPress={props.onClose} style={styles.safetyDismiss} />
        <View style={styles.safetyCard}>
          {props.mode === 'block' ? (
            <>
              <Text accessibilityRole="header" style={styles.safetyTitle}>Chặn {props.displayName}?</Text>
              <Text style={styles.mutedText}>Hai tài khoản sẽ không thể tìm thấy nhau, xem hồ sơ hoặc gửi tin nhắn.</Text>
              <View style={styles.inlineActions}><Pressable accessibilityRole="button" onPress={props.onClose} style={styles.smallOutline}><Text style={styles.smallOutlineText}>Hủy</Text></Pressable><Pressable accessibilityRole="button" disabled={props.busyAction !== null} onPress={props.onBlock} style={styles.dangerFilled}><Text style={styles.dangerFilledText}>Xác nhận chặn</Text></Pressable></View>
            </>
          ) : (
            <>
              <Text accessibilityRole="header" style={styles.safetyTitle}>Báo cáo tài khoản</Text>
              <View style={styles.reasonWrap}>{REPORT_REASON_OPTIONS.map((reason) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: props.reason === reason.code }} key={reason.code} onPress={() => props.onReasonChange(reason.code)} style={[styles.reasonChip, props.reason === reason.code && styles.reasonChipActive]}><Text style={styles.reasonText}>{reason.label}</Text></Pressable>)}</View>
              <TextInput accessibilityLabel="Mô tả bổ sung cho báo cáo" maxLength={1000} multiline onChangeText={props.onDescriptionChange} placeholder="Mô tả ngắn sự việc" placeholderTextColor={chonColors.softMuted} style={styles.reportInput} value={props.reportDescription} />
              <View style={styles.inlineActions}><Pressable accessibilityRole="button" onPress={props.onClose} style={styles.smallOutline}><Text style={styles.smallOutlineText}>Hủy</Text></Pressable><Pressable accessibilityRole="button" disabled={props.busyAction !== null} onPress={props.onReport} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{props.busyAction === 'report' ? 'Đang gửi…' : 'Gửi báo cáo'}</Text></Pressable></View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function LoadingScreen() { return <View style={styles.centeredPage}><ActivityIndicator color={chonColors.primaryRed} size="large" /><Text style={styles.mutedText}>Đang tải hồ sơ…</Text></View>; }
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
  page: { backgroundColor: chonColors.surface, flex: 1 },
  pageContent: { paddingBottom: 80 },
  profileFrame: { alignSelf: 'center', maxWidth: chonLayout.contentMaxWidth, width: '100%' },
  profileFrameDesktop: { alignItems: 'flex-start', flexDirection: 'row', gap: 24, paddingHorizontal: chonLayout.contentHorizontalPaddingDesktop, paddingTop: 24 },
  profileFrameMobile: { gap: 16, paddingHorizontal: chonLayout.contentHorizontalPaddingMobile, paddingTop: 14 },
  leftColumn: { width: '100%' },
  leftColumnDesktop: { flexBasis: 330, flexGrow: 0, flexShrink: 0, width: 330 },
  rightColumn: { flex: 1, minWidth: 0 },
  heroPhotoFrame: { borderRadius: 14, overflow: 'hidden', position: 'relative', width: '100%' },
  heroPhoto: { aspectRatio: 0.72, borderRadius: 14, width: '100%' },
  heroPhotoPressTarget: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 8 },
  heroFavorite: { bottom: 10, position: 'absolute', right: 10, zIndex: 9 },
  privateActionWrap: { marginTop: 10 },
  sideMeta: { borderBottomColor: chonColors.border, borderBottomWidth: 1, borderTopColor: chonColors.border, borderTopWidth: 1, gap: 10, marginTop: 14, paddingVertical: 14 },
  sideMetaRow: { alignItems: 'center', flexDirection: 'row', gap: 9, minHeight: 24 },
  sideMetaText: { color: chonColors.text, flex: 1, fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body },
  identityHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', minHeight: 110, paddingBottom: 14 },
  identityCopy: { flex: 1, minWidth: 0, paddingRight: 12 },
  displayName: { color: chonColors.text, fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h1Desktop, fontWeight: '400', lineHeight: chonTypography.lineHeights.h1Desktop },
  displayNameMobile: { fontSize: chonTypography.sizes.h2, lineHeight: chonTypography.lineHeights.h2 },
  locationText: { color: chonColors.text, fontSize: chonTypography.sizes.h3, lineHeight: chonTypography.lineHeights.h3 },
  headline: { color: chonColors.muted, fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body, marginTop: 2 },
  moreWrap: { position: 'relative', zIndex: 20 },
  moreButton: { alignItems: 'center', borderColor: chonColors.border, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  moreText: { color: chonColors.muted, fontSize: 18, letterSpacing: 1 },
  moreMenu: { backgroundColor: chonColors.surface, borderColor: chonColors.border, borderRadius: 8, borderWidth: 1, minWidth: 180, position: 'absolute', right: 0, top: 48, zIndex: 30, ...chonShadows.card },
  moreMenuItem: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  moreMenuText: { color: chonColors.text, fontSize: chonTypography.sizes.body },
  moreMenuDanger: { color: chonColors.danger, fontSize: chonTypography.sizes.body },
  messageComposer: { backgroundColor: chonColors.warmSurface, borderRadius: 12, gap: 12, marginBottom: 18, padding: 14 },
  profileMessageInput: { backgroundColor: chonColors.surface, borderColor: chonColors.border, borderRadius: 8, borderWidth: 1, color: chonColors.text, fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body, minHeight: 82, padding: 12, textAlignVertical: 'top' },
  messageButton: { alignItems: 'center', alignSelf: 'flex-end', backgroundColor: chonColors.primaryRed, borderRadius: 999, justifyContent: 'center', minHeight: 44, minWidth: 118, paddingHorizontal: 20 },
  messageButtonText: { color: '#FFFFFF', fontSize: chonTypography.sizes.body, fontWeight: '700' },
  galleryDesktop: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 22 },
  galleryMobile: { marginHorizontal: -chonLayout.contentHorizontalPaddingMobile, marginBottom: 20 },
  galleryMobileContent: { gap: 10, paddingHorizontal: chonLayout.contentHorizontalPaddingMobile },
  photoTile: { backgroundColor: chonColors.warmSurface, borderRadius: 12, height: 250, overflow: 'hidden', position: 'relative', width: 240 },
  photoTileDesktop: { flexBasis: '31%', flexGrow: 1, minWidth: 220, maxWidth: 310 },
  photoTileImage: { height: '100%', width: '100%' },
  photoTileFallback: { alignItems: 'center', height: '100%', justifyContent: 'center', width: '100%' },
  photoHeart: { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 18, bottom: 8, padding: 6, position: 'absolute', right: 8 },
  storyWrap: { gap: 24 },
  storySection: { borderTopColor: chonColors.border, borderTopWidth: 1, gap: 8, paddingTop: 18 },
  sectionHeadingRow: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionTitle: { color: chonColors.text, fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h2, fontWeight: '600', lineHeight: chonTypography.lineHeights.h2 },
  storyText: { color: chonColors.text, fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body },
  storyMeta: { color: chonColors.muted, fontSize: chonTypography.sizes.help, lineHeight: chonTypography.lineHeights.help },
  interestedIn: { color: chonColors.goldStrong, fontSize: chonTypography.sizes.body, fontWeight: '700' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag: { backgroundColor: chonColors.warmSurfaceStrong, borderColor: chonColors.gold, borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
  tagText: { color: chonColors.goldStrong, fontSize: chonTypography.sizes.body, fontWeight: '700' },
  infoList: { borderColor: chonColors.border, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  infoRow: { alignItems: 'center', borderBottomColor: chonColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 14, justifyContent: 'space-between', minHeight: 44, paddingHorizontal: 12, paddingVertical: 8 },
  infoLabel: { color: chonColors.text, flex: 1, fontSize: chonTypography.sizes.body, fontWeight: '700', lineHeight: chonTypography.lineHeights.body },
  infoValue: { color: chonColors.text, flex: 1, fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body, textAlign: 'right' },
  warningCard: { backgroundColor: chonColors.warmSurface, borderColor: chonColors.gold, borderRadius: 12, borderWidth: 1, gap: 10, padding: 16 },
  warningTitle: { color: chonColors.text, fontSize: chonTypography.sizes.h3, fontWeight: '700' },
  mutedText: { color: chonColors.muted, fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body },
  success: { color: chonColors.online, fontSize: chonTypography.sizes.body, marginTop: 12 },
  error: { color: chonColors.danger, fontSize: chonTypography.sizes.body, marginTop: 12 },
  centeredPage: { alignItems: 'center', backgroundColor: chonColors.surface, flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  notFoundTitle: { color: chonColors.text, fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h2 },
  outlineButton: { alignItems: 'center', borderColor: chonColors.gold, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 20 },
  outlineButtonText: { color: chonColors.text, fontSize: chonTypography.sizes.body, fontWeight: '700' },
  primaryButton: { alignItems: 'center', backgroundColor: chonColors.primaryRed, borderRadius: 999, justifyContent: 'center', minHeight: 44, paddingHorizontal: 18 },
  primaryButtonText: { color: '#FFFFFF', fontSize: chonTypography.sizes.body, fontWeight: '700' },
  pressed: { opacity: 0.78 },
  safetyBackdrop: { alignItems: 'center', backgroundColor: chonColors.overlay, flex: 1, justifyContent: 'center', padding: 18 },
  safetyDismiss: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  safetyCard: { backgroundColor: chonColors.surface, borderRadius: 14, gap: 14, maxWidth: 520, padding: 20, width: '100%' },
  safetyTitle: { color: chonColors.text, fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h2, fontWeight: '600' },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' },
  smallOutline: { alignItems: 'center', borderColor: chonColors.gold, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 },
  smallOutlineText: { color: chonColors.text, fontSize: chonTypography.sizes.body, fontWeight: '700' },
  dangerFilled: { alignItems: 'center', backgroundColor: chonColors.danger, borderRadius: 999, justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 },
  dangerFilledText: { color: '#FFFFFF', fontSize: chonTypography.sizes.body, fontWeight: '700' },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: { borderColor: chonColors.border, borderRadius: 999, borderWidth: 1, minHeight: 38, paddingHorizontal: 12, paddingVertical: 9 },
  reasonChipActive: { backgroundColor: chonColors.warmSurfaceStrong, borderColor: chonColors.gold },
  reasonText: { color: chonColors.text, fontSize: chonTypography.sizes.body },
  reportInput: { borderColor: chonColors.border, borderRadius: 8, borderWidth: 1, color: chonColors.text, fontSize: chonTypography.sizes.body, minHeight: 100, padding: 12, textAlignVertical: 'top' },
});