import {
  createPrivateMediaUrl,
  getMediaById,
  getMyProfile,
  isMediaHiddenByModeration,
  isMediaVisibleToOwner,
  listMyMedia,
  setMyProfilePhotoVisibility,
  uploadProfileImage,
  type MyMediaItem,
} from '@myfan/supabase';
import { luxyBreakpoints, luxyColors, luxyRadii, luxySpacing } from '@myfan/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Screen } from '@/components/screen';
import {
  getReadableProfileMediaError,
  pickAndPrepareProfileImage,
  type ProfileImageSource,
} from '@/lib/profile-media';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type UploadVisibility = 'avatar' | 'public';
type ManagedPhoto = MyMediaItem & { url: string };

const profileQueryKey = (userId: string | null) => ['profile', 'me', userId] as const;
const mediaQueryKey = (userId: string | null) => ['profile', 'media', userId] as const;

export default function Page() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const { width } = useWindowDimensions();
  const desktop = width >= luxyBreakpoints.desktop;
  const [uploading, setUploading] = useState<UploadVisibility | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: profileQueryKey(auth.userId),
    enabled: Boolean(client && auth.userId),
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyProfile(client);
    },
  });

  const mediaQuery = useQuery({
    queryKey: mediaQueryKey(auth.userId),
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client) return [] as ManagedPhoto[];
      const rows = await listMyMedia(client);
      const eligible = rows.filter((item) =>
        (item.visibility === 'public' || item.visibility === 'private') && isMediaVisibleToOwner(item),
      );
      return Promise.all(eligible.map(async (item) => ({
        ...item,
        url: await createPrivateMediaUrl(client, item),
      })));
    },
  });

  const rawMediaQuery = useQuery({
    queryKey: ['profile', 'media-raw', auth.userId],
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client) return [] as MyMediaItem[];
      return listMyMedia(client);
    },
  });

  const avatarUrlQuery = useQuery({
    queryKey: ['profile', 'avatar-url', profileQuery.data?.avatar_media_id],
    enabled: Boolean(client && profileQuery.data?.avatar_media_id),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client || !profileQuery.data?.avatar_media_id) return null;
      const media = await getMediaById(client, profileQuery.data.avatar_media_id);
      if (!media || !['pending_review', 'approved'].includes(media.moderation_status)) return null;
      return createPrivateMediaUrl(client, media);
    },
  });

  async function refreshProfile() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: profileQueryKey(auth.userId) }),
      queryClient.invalidateQueries({ queryKey: mediaQueryKey(auth.userId) }),
      queryClient.invalidateQueries({ queryKey: ['profile', 'media-raw', auth.userId] }),
      queryClient.invalidateQueries({ queryKey: ['profile', 'album', auth.userId] }),
      queryClient.invalidateQueries({ queryKey: ['profile', 'avatar-url'] }),
      queryClient.invalidateQueries({ queryKey: ['luxy-member-profile'] }),
      queryClient.invalidateQueries({ queryKey: ['private-photo-media'] }),
      queryClient.invalidateQueries({ queryKey: ['private-photo-access'] }),
    ]);
  }

  async function handleUpload(visibility: UploadVisibility, source: ProfileImageSource) {
    if (!client) {
      setErrorMessage('Supabase chưa được cấu hình.');
      return;
    }
    setUploading(visibility);
    setMessage(null);
    setErrorMessage(null);
    try {
      const prepared = await pickAndPrepareProfileImage(source, visibility);
      if (!prepared) return;
      await uploadProfileImage(client, prepared);
      await refreshProfile();
      setMessage(
        visibility === 'avatar'
          ? 'Ảnh đại diện đã được cập nhật.'
          : 'Ảnh mới đã được thêm và mặc định hiển thị công khai. Bạn có thể Ẩn bất cứ lúc nào.',
      );
    } catch (error) {
      setErrorMessage(getReadableProfileMediaError(error));
    } finally {
      setUploading(null);
    }
  }

  async function handleToggle(photo: ManagedPhoto) {
    if (!client || (photo.visibility !== 'public' && photo.visibility !== 'private')) return;
    const target = photo.visibility === 'public' ? 'private' : 'public';
    setTogglingId(photo.id);
    setMessage(null);
    setErrorMessage(null);
    try {
      await setMyProfilePhotoVisibility(client, photo.id, target);
      await refreshProfile();
      setMessage(target === 'private'
        ? 'Ảnh đã được Ẩn và chuyển vào Ảnh riêng tư. Chỉ Premium/Diamond có thể xem.'
        : 'Ảnh đã được Hiện công khai trên hồ sơ.');
    } catch (error) {
      setErrorMessage(getReadableProfileMediaError(error));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSignOut() {
    setErrorMessage(null);
    try {
      await auth.signOut();
      router.replace('/(auth)');
    } catch (error) {
      setErrorMessage(getReadableProfileMediaError(error));
    }
  }

  if (profileQuery.isLoading) {
    return (
      <Screen title="Hồ sơ của tôi" description="Đang tải hồ sơ của bạn.">
        <ActivityIndicator color={luxyColors.ink} />
      </Screen>
    );
  }

  const profile = profileQuery.data;
  const hiddenMediaCount = (rawMediaQuery.data ?? []).filter(isMediaHiddenByModeration).length;
  const publicCount = (mediaQuery.data ?? []).filter((item) => item.visibility === 'public').length;
  const privateCount = (mediaQuery.data ?? []).filter((item) => item.visibility === 'private').length;

  return (
    <Screen
      title="Hồ sơ của tôi"
      description="Quản lý thông tin, ảnh công khai, ảnh riêng tư và trạng thái xác thực trong một không gian thống nhất."
    >
      <View style={[styles.profileHero, desktop && styles.profileHeroDesktop]}>
        <View style={[styles.profileHeader, desktop && styles.profileHeaderDesktop]}>
          {avatarUrlQuery.data ? (
            <Image accessibilityLabel="Ảnh đại diện" source={{ uri: avatarUrlQuery.data }} style={[styles.avatar, desktop && styles.avatarDesktop]} />
          ) : (
            <View accessibilityLabel="Chưa có ảnh đại diện" style={[styles.avatarFallback, desktop && styles.avatarDesktop]}>
              <Text style={[styles.avatarFallbackText, desktop && styles.avatarFallbackTextDesktop]}>{(profile?.display_name ?? profile?.username ?? 'C').slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.identity}>
            <Text style={[styles.displayName, desktop && styles.displayNameDesktop]}>{profile?.display_name || 'Hoàn thiện hồ sơ'}</Text>
            <Text style={styles.username}>{profile?.username ? `@${profile.username}` : 'Chưa có username'}</Text>
            <View style={styles.photoSummaryRow}>
              <View style={styles.summaryDot} />
              <Text style={styles.photoSummary}>{publicCount} ảnh công khai</Text>
              <Text style={styles.photoSummarySeparator}>·</Text>
              <Text style={styles.photoSummary}>{privateCount} ảnh riêng tư</Text>
            </View>
          </View>
        </View>

        <View style={[styles.heroActions, desktop && styles.heroActionsDesktop]}>
          <View style={styles.actionRow}>
            <ActionButton disabled={uploading !== null} label="Chọn avatar" onPress={() => handleUpload('avatar', 'library')} />
            <ActionButton disabled={uploading !== null} label="Chụp avatar" onPress={() => handleUpload('avatar', 'camera')} />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/profile/edit')}
            style={({ pressed }) => [styles.primaryEditButton, pressed && styles.primaryEditButtonPressed]}
          >
            <Text style={styles.primaryEditButtonText}>Chỉnh sửa hồ sơ</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.contentGrid, desktop && styles.contentGridDesktop]}>
        <View style={[styles.mainColumn, desktop && styles.mainColumnDesktop]}>
          <View style={[styles.section, desktop && styles.sectionDesktop]}> 
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.sectionTitle}>Ảnh của tôi</Text>
                <Text style={styles.sectionCaption}>Quản lý ảnh hiển thị trên hồ sơ thành viên.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={uploading !== null}
                onPress={() => void handleUpload('public', 'library')}
                style={({ pressed }) => [styles.addPhotoButton, pressed && styles.secondaryPressed]}
                testID="luxy-add-public-photo"
              >
                <Text style={styles.addPhotoText}>{uploading === 'public' ? 'Đang thêm ảnh…' : '+ Thêm ảnh'}</Text>
              </Pressable>
            </View>
            <Text style={styles.bodyText}>
              Ảnh mới mặc định công khai. Chọn “Ẩn” để chuyển sang Ảnh riêng tư; chọn “Hiện công khai” để đưa ảnh trở lại hồ sơ.
            </Text>

            {mediaQuery.isLoading ? <ActivityIndicator color={luxyColors.ink} /> : null}
            {!mediaQuery.isLoading && mediaQuery.data?.length ? (
              <View style={styles.gallery} testID="luxy-owned-photo-management">
                {mediaQuery.data.map((photo) => (
                  <ManagedPhotoCard
                    busy={togglingId === photo.id}
                    key={photo.id}
                    onToggle={() => void handleToggle(photo)}
                    photo={photo}
                  />
                ))}
              </View>
            ) : null}
            {!mediaQuery.isLoading && !mediaQuery.data?.length ? (
              <Text style={styles.bodyText}>Chưa có ảnh bổ sung. Ảnh đầu tiên bạn thêm sẽ hiển thị công khai.</Text>
            ) : null}
          </View>

          <View style={styles.privateNote}>
            <View style={styles.privateNoteIcon}><Text style={styles.privateNoteIconText}>◉</Text></View>
            <View style={styles.privateNoteCopy}>
              <Text style={styles.privateNoteTitle}>Ảnh riêng tư</Text>
              <Text style={styles.privateNoteText}>
                Premium và Diamond xem trực tiếp các ảnh bạn đánh dấu Riêng tư. Free chỉ thấy khu vực ảnh bị khóa và lời mời nâng cấp; quà tặng không mở khóa ảnh.
              </Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/settings/private-photos')} style={({ pressed }) => [styles.inlineLink, pressed && styles.secondaryPressed]}>
                <Text style={styles.inlineLinkText}>Quản lý Ảnh riêng tư →</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.sideColumn, desktop && styles.sideColumnDesktop]}>
          <View style={[styles.sideCard, !desktop && styles.section]}>
            <Text style={styles.sectionTitle}>Giới thiệu</Text>
            <Text style={styles.bodyText}>{profile?.bio || 'Chưa có phần giới thiệu.'}</Text>
          </View>

          <View style={[styles.sideCard, !desktop && styles.section]}>
            <View style={styles.sideCardTitleRow}>
              <View style={styles.sideIcon}><Text style={styles.sideIconText}>✓</Text></View>
              <Text style={styles.sectionTitle}>Xác thực</Text>
            </View>
            <Text style={styles.bodyText}>Tăng độ tin cậy hồ sơ bằng các bước xác thực phù hợp.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/settings/verification')} style={({ pressed }) => [styles.settingsButton, pressed && styles.secondaryPressed]}>
              <Text style={styles.settingsButtonText}>Selfie · CCCD · LinkedIn</Text>
            </Pressable>
          </View>

          {hiddenMediaCount > 0 ? (
            <View style={styles.hiddenNotice}>
              <Text style={styles.hiddenNoticeText}>{hiddenMediaCount} ảnh không còn hiển thị do trạng thái kiểm duyệt.</Text>
            </View>
          ) : null}

          {uploading || togglingId ? <ActivityIndicator color={luxyColors.ink} /> : null}
          {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
          {errorMessage || profileQuery.error || mediaQuery.error ? (
            <Text accessibilityRole="alert" style={styles.error}>{errorMessage ?? 'Không thể tải đầy đủ hồ sơ. Hãy thử lại.'}</Text>
          ) : null}

          <View style={[styles.sideCard, styles.safetyCard, !desktop && styles.section]}>
            <Text style={styles.sectionTitle}>Tài khoản và an toàn</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/settings/account-deletion')} style={({ pressed }) => [styles.settingsButton, pressed && styles.secondaryPressed]}>
              <Text style={styles.settingsButtonText}>Yêu cầu xóa tài khoản</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={handleSignOut} style={({ pressed }) => [styles.signOutButton, pressed && styles.secondaryPressed]}>
              <Text style={styles.signOutText}>Đăng xuất</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}

function ManagedPhotoCard({ photo, busy, onToggle }: { photo: ManagedPhoto; busy: boolean; onToggle: () => void }) {
  const isPrivate = photo.visibility === 'private';
  return (
    <View style={styles.photoCard} testID={`luxy-owned-photo-${photo.id}`}>
      <View style={styles.photoFrame}>
        <Image accessibilityLabel={isPrivate ? 'Ảnh riêng tư' : 'Ảnh công khai'} source={{ uri: photo.url }} style={styles.photo} />
        <View style={[styles.visibilityBadge, isPrivate && styles.privateBadge]}>
          <Text style={styles.visibilityBadgeText}>{isPrivate ? 'Ảnh riêng tư' : 'Công khai'}</Text>
        </View>
      </View>
      <View style={styles.photoMetaRow}>
        <Text style={styles.photoStatus}>{moderationStatusLabel(photo.moderation_status)}</Text>
        <Text style={styles.photoVisibilityDot}>•</Text>
        <Text style={styles.photoStatus}>{isPrivate ? 'Riêng tư' : 'Công khai'}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onToggle}
        style={({ pressed }) => [styles.visibilityButton, isPrivate && styles.visibilityButtonPublic, pressed && styles.secondaryPressed]}
      >
        {busy ? <ActivityIndicator color={luxyColors.ink} size="small" /> : (
          <Text style={styles.visibilityButtonText}>{isPrivate ? 'Hiện công khai' : 'Ẩn'}</Text>
        )}
      </Pressable>
    </View>
  );
}

function ActionButton({ disabled, label, onPress }: { disabled: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryPressed]}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function moderationStatusLabel(status: MyMediaItem['moderation_status']): string {
  if (status === 'approved') return 'Đã duyệt';
  if (status === 'pending_review') return 'Đang kiểm tra';
  if (status === 'quarantined') return 'Đang xem xét';
  if (status === 'rejected') return 'Không đạt';
  return status;
}

const styles = StyleSheet.create({
  profileHero: { gap: luxySpacing.md },
  profileHeroDesktop: {
    alignItems: 'center',
    backgroundColor: '#FCFCFC',
    borderColor: luxyColors.border,
    borderRadius: luxyRadii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 24,
    justifyContent: 'space-between',
    padding: 22,
  },
  profileHeader: { alignItems: 'center', flexDirection: 'row', gap: luxySpacing.md },
  profileHeaderDesktop: { flex: 1, minWidth: 0 },
  avatar: { backgroundColor: luxyColors.elevatedSubtle, borderRadius: 44, height: 88, width: 88 },
  avatarDesktop: { borderRadius: 56, height: 112, width: 112 },
  avatarFallback: { alignItems: 'center', backgroundColor: luxyColors.brandWarmSurface, borderColor: luxyColors.brandGold, borderRadius: 44, borderWidth: 1, height: 88, justifyContent: 'center', width: 88 },
  avatarFallbackText: { color: luxyColors.actionRed, fontSize: 32, fontWeight: '700' },
  avatarFallbackTextDesktop: { fontSize: 38 },
  identity: { flex: 1, gap: 4, minWidth: 0 },
  displayName: { color: luxyColors.text, fontSize: 22, fontWeight: '700' },
  displayNameDesktop: { fontSize: 26, lineHeight: 32 },
  username: { color: luxyColors.muted, fontSize: 14 },
  photoSummaryRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  summaryDot: { backgroundColor: luxyColors.online, borderRadius: 4, height: 7, width: 7 },
  photoSummary: { color: luxyColors.muted, fontSize: 12.5 },
  photoSummarySeparator: { color: luxyColors.softMuted, fontSize: 12.5 },
  heroActions: { gap: 10 },
  heroActionsDesktop: { minWidth: 330, width: 340 },
  actionRow: { flexDirection: 'row', gap: luxySpacing.sm },
  secondaryButton: { alignItems: 'center', backgroundColor: luxyColors.surface, borderColor: luxyColors.borderStrong, borderRadius: luxyRadii.pill, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: luxySpacing.sm },
  secondaryButtonText: { color: luxyColors.charcoal, fontSize: 13.5, fontWeight: '700' },
  primaryEditButton: { alignItems: 'center', backgroundColor: luxyColors.actionRed, borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 48 },
  primaryEditButtonPressed: { backgroundColor: '#A81415', opacity: 0.94 },
  primaryEditButtonText: { color: luxyColors.surface, fontSize: 14, fontWeight: '800' },
  contentGrid: { gap: 0 },
  contentGridDesktop: { alignItems: 'flex-start', flexDirection: 'row', gap: 24 },
  mainColumn: { minWidth: 0 },
  mainColumnDesktop: { flex: 1.75 },
  sideColumn: { minWidth: 0 },
  sideColumnDesktop: { flex: 0.9, gap: 14 },
  section: { gap: luxySpacing.sm, marginTop: luxySpacing.xl },
  sectionDesktop: { marginTop: 24 },
  sectionHeadingRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  sectionTitle: { color: luxyColors.charcoal, fontSize: 18, fontWeight: '700' },
  sectionCaption: { color: luxyColors.softMuted, fontSize: 11.5, marginTop: 3 },
  bodyText: { color: luxyColors.muted, fontSize: 14, lineHeight: 21 },
  addPhotoButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: luxyColors.brandWarmSurface, borderColor: luxyColors.brandGold, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: 16 },
  addPhotoText: { color: luxyColors.brandGoldStrong, fontSize: 13, fontWeight: '800' },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: luxySpacing.md, marginTop: 4 },
  photoCard: { gap: 7, minWidth: 145, width: '31%' },
  photoFrame: { aspectRatio: 0.78, backgroundColor: luxyColors.elevatedSubtle, borderRadius: luxyRadii.sm, overflow: 'hidden', position: 'relative', width: '100%' },
  photo: { height: '100%', width: '100%' },
  visibilityBadge: { backgroundColor: 'rgba(8,23,38,0.72)', borderRadius: luxyRadii.pill, left: 7, paddingHorizontal: 8, paddingVertical: 4, position: 'absolute', top: 7 },
  privateBadge: { backgroundColor: 'rgba(200,28,29,0.88)' },
  visibilityBadgeText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  photoMetaRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  photoStatus: { color: luxyColors.muted, fontSize: 11.5 },
  photoVisibilityDot: { color: luxyColors.brandGoldStrong, fontSize: 11 },
  visibilityButton: { alignItems: 'center', backgroundColor: luxyColors.surface, borderColor: luxyColors.border, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 38, paddingHorizontal: 10 },
  visibilityButtonPublic: { borderColor: luxyColors.actionRed },
  visibilityButtonText: { color: luxyColors.text, fontSize: 12, fontWeight: '700' },
  privateNote: { alignItems: 'flex-start', backgroundColor: '#F4F9FF', borderColor: '#B9D8F4', borderRadius: luxyRadii.md, borderWidth: 1, flexDirection: 'row', gap: 12, marginTop: luxySpacing.xl, padding: luxySpacing.lg },
  privateNoteIcon: { alignItems: 'center', borderColor: luxyColors.brandBlue, borderRadius: luxyRadii.pill, borderWidth: 1, height: 30, justifyContent: 'center', width: 30 },
  privateNoteIconText: { color: luxyColors.brandBlue, fontSize: 12, fontWeight: '700' },
  privateNoteCopy: { flex: 1, gap: 6 },
  privateNoteTitle: { color: luxyColors.charcoal, fontSize: 15, fontWeight: '700' },
  privateNoteText: { color: luxyColors.muted, fontSize: 13, lineHeight: 19 },
  inlineLink: { alignSelf: 'flex-start', paddingVertical: 4 },
  inlineLinkText: { color: luxyColors.actionRed, fontSize: 12.5, fontWeight: '700' },
  sideCard: { backgroundColor: '#FCFCFC', borderColor: luxyColors.border, borderRadius: luxyRadii.md, borderWidth: 1, gap: 9, padding: 18 },
  sideCardTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  sideIcon: { alignItems: 'center', backgroundColor: luxyColors.brandWarmSurface, borderRadius: luxyRadii.pill, height: 26, justifyContent: 'center', width: 26 },
  sideIconText: { color: luxyColors.brandGoldStrong, fontSize: 12, fontWeight: '800' },
  hiddenNotice: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderRadius: luxyRadii.sm, borderWidth: 1, padding: luxySpacing.md },
  hiddenNoticeText: { color: luxyColors.danger, fontSize: 13, lineHeight: 20 },
  settingsButton: { alignItems: 'center', backgroundColor: luxyColors.surface, borderColor: luxyColors.border, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  settingsButtonText: { color: luxyColors.charcoal, fontSize: 13.5, fontWeight: '700' },
  success: { backgroundColor: '#F0FDF4', borderRadius: luxyRadii.sm, color: '#166534', fontSize: 13, padding: 10 },
  error: { backgroundColor: '#FEF2F2', borderRadius: luxyRadii.sm, color: luxyColors.danger, fontSize: 13, padding: 10 },
  safetyCard: { marginBottom: 2 },
  signOutButton: { alignItems: 'center', borderColor: '#F3B6B6', borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44 },
  signOutText: { color: luxyColors.actionRed, fontSize: 14, fontWeight: '700' },
  secondaryPressed: { backgroundColor: luxyColors.brandWarmSurface, opacity: 0.84 },
});
