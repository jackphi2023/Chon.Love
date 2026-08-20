import {
  createPublicProfileMediaUrl,
  getMyProfile,
  listMyMedia,
  uploadProfileImage,
  type MyMediaItem,
} from '@myfan/supabase';
import { colors, luxyBreakpoints, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  SignupHelpText,
  SignupPrimaryButton,
  SignupSecondaryButton,
  SignupShell,
} from '@/components/signup-shell';
import { getMyOnboardingStatus, getReadableOnboardingError } from '@/lib/onboarding';
import {
  getReadableProfileMediaError,
  pickAndPrepareProfileImages,
  type PreparedLocalProfileImage,
} from '@/lib/profile-media';
import {
  isUsableSignupProfilePhoto,
  remainingSignupPhotoSlots,
  SIGNUP_PROFILE_PHOTO_LIMIT,
  SIGNUP_RECOMMENDED_PHOTO_COUNT,
  signupUploadVisibility,
} from '@/lib/signup-photo-contract';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type ExistingPhoto = {
  id: string;
  uri: string | null;
  visibility: 'avatar' | 'public';
};

type PhotoSlot =
  | { kind: 'existing'; photo: ExistingPhoto }
  | { kind: 'pending'; photo: PreparedLocalProfileImage; pendingIndex: number }
  | null;

function sortSignupMedia(rows: MyMediaItem[]): MyMediaItem[] {
  return [...rows].sort((left, right) => {
    if (left.visibility === 'avatar' && right.visibility !== 'avatar') return -1;
    if (right.visibility === 'avatar' && left.visibility !== 'avatar') return 1;
    return (right.uploaded_at ?? right.created_at).localeCompare(left.uploaded_at ?? left.created_at);
  });
}

export default function OnboardingPhotos() {
  const router = useRouter();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < luxyBreakpoints.mobile;
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PreparedLocalProfileImage[]>([]);
  const [hasAvatar, setHasAvatar] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalCount = Math.min(SIGNUP_PROFILE_PHOTO_LIMIT, existingPhotos.length + pendingPhotos.length);
  const remainingSlots = remainingSignupPhotoSlots(existingPhotos.length, pendingPhotos.length);
  const hasRequiredPhoto = totalCount >= 1 && (hasAvatar || pendingPhotos.length > 0);
  const recommendedReached = totalCount >= SIGNUP_RECOMMENDED_PHOTO_COUNT;

  const slots = useMemo<PhotoSlot[]>(() => {
    const items: PhotoSlot[] = existingPhotos.map((photo) => ({ kind: 'existing', photo }));
    pendingPhotos.forEach((photo, pendingIndex) => items.push({ kind: 'pending', photo, pendingIndex }));
    while (items.length < SIGNUP_PROFILE_PHOTO_LIMIT) items.push(null);
    return items.slice(0, SIGNUP_PROFILE_PHOTO_LIMIT);
  }, [existingPhotos, pendingPhotos]);

  useEffect(() => {
    if (auth.isRestoring) return;
    if (!auth.userId) {
      router.replace('/(auth)');
      return;
    }

    const client = getMobileSupabaseClient();
    if (!client) {
      setErrorMessage('Kết nối ảnh hồ sơ chưa được cấu hình.');
      setIsChecking(false);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const status = await getMyOnboardingStatus();
        if (!active || !status) return;
        if (status.account_status !== 'active') {
          setAccountStatus(status.account_status);
          return;
        }
        if (status.profile_status === 'active') {
          router.replace('/(tabs)');
          return;
        }
        if (status.profile_status !== 'incomplete') {
          router.replace('/onboarding/selfie');
          return;
        }
        if (!status.age_verified || !status.policies_accepted) {
          router.replace('/(onboarding)');
          return;
        }

        const [profile, mediaRows] = await Promise.all([getMyProfile(client), listMyMedia(client)]);
        if (!active) return;
        if (profile.province_id == null) {
          router.replace('/onboarding/location');
          return;
        }
        const lookingForLength = profile.looking_for?.trim().length ?? 0;
        const lifestyleTagCount = profile.lifestyle_tags?.length ?? 0;
        if (lookingForLength < 50 || lookingForLength > 4000 || lifestyleTagCount < 1 || lifestyleTagCount > 7) {
          router.replace('/onboarding/looking-for');
          return;
        }

        const usable = sortSignupMedia(mediaRows.filter(isUsableSignupProfilePhoto)).slice(0, SIGNUP_PROFILE_PHOTO_LIMIT);
        const signed = await Promise.all(
          usable.map(async (media) => {
            let uri: string | null = null;
            try {
              uri = await createPublicProfileMediaUrl(client, media);
            } catch {
              // The finalized media still counts even if a transient signed-URL request fails.
            }
            return {
              id: media.id,
              uri,
              visibility: media.visibility as 'avatar' | 'public',
            } satisfies ExistingPhoto;
          }),
        );
        if (!active) return;
        setExistingPhotos(signed);
        setHasAvatar(Boolean(profile.avatar_media_id) || usable.some((item) => item.visibility === 'avatar'));
      } catch (error) {
        if (active) setErrorMessage(getReadableOnboardingError(error));
      } finally {
        if (active) setIsChecking(false);
      }
    })();

    return () => { active = false; };
  }, [auth.isRestoring, auth.userId, router]);

  async function choosePhotos() {
    if (remainingSlots <= 0) return;
    setIsSelecting(true);
    setErrorMessage(null);
    try {
      const selected = await pickAndPrepareProfileImages('public', remainingSlots);
      if (!selected.length) return;
      setPendingPhotos((current) => [...current, ...selected].slice(0, remainingSignupPhotoSlots(existingPhotos.length, 0)));
    } catch (error) {
      setErrorMessage(getReadableProfileMediaError(error));
    } finally {
      setIsSelecting(false);
    }
  }

  function removePending(pendingIndex: number) {
    setErrorMessage(null);
    setPendingPhotos((current) => current.filter((_, index) => index !== pendingIndex));
  }

  async function continueNext() {
    if (!hasRequiredPhoto) {
      setErrorMessage('Bạn cần ít nhất một ảnh hồ sơ. Ảnh đầu tiên sẽ được dùng làm ảnh đại diện.');
      return;
    }

    const client = getMobileSupabaseClient();
    if (!client) return;
    setIsUploading(true);
    setErrorMessage(null);
    try {
      const avatarAlreadyExists = hasAvatar;
      for (let index = 0; index < pendingPhotos.length; index += 1) {
        const localPhoto = pendingPhotos[index]!;
        const visibility = signupUploadVisibility(avatarAlreadyExists, index);
        const uploaded = await uploadProfileImage(client, { ...localPhoto, visibility });
        let uri: string | null = null;
        try {
          uri = await createPublicProfileMediaUrl(client, uploaded);
        } catch {
          // Upload/finalize succeeded; a preview URL can be retried on the next mount.
        }
        setExistingPhotos((current) => [
          ...current,
          { id: uploaded.id, uri, visibility },
        ].slice(0, SIGNUP_PROFILE_PHOTO_LIMIT));
        setPendingPhotos((current) => current.filter((item) => item !== localPhoto));
        if (visibility === 'avatar') setHasAvatar(true);
      }

      router.replace('/onboarding/about');
    } catch (error) {
      setErrorMessage(getReadableProfileMediaError(error));
    } finally {
      setIsUploading(false);
    }
  }

  if (isChecking || auth.isRestoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.muted}>Đang tải ảnh hồ sơ…</Text>
      </View>
    );
  }

  if (accountStatus) {
    const deletionRequested = accountStatus === 'deletion_requested';
    return (
      <SignupShell
        description={deletionRequested ? 'Hồ sơ và tính năng xã hội đang tắt trong thời gian chờ xử lý yêu cầu xóa.' : 'Tài khoản đang bị đình chỉ hoặc vô hiệu hóa.'}
        testID="chon-photos-account-status"
        title={deletionRequested ? 'Tài khoản đang chờ xóa' : 'Tài khoản chưa thể truy cập'}
      >
        <Pressable accessibilityRole="button" onPress={() => void auth.signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Đăng xuất</Text>
        </Pressable>
      </SignupShell>
    );
  }

  return (
    <SignupShell
      description="Thêm ảnh thật, rõ khuôn mặt và đúng với bạn. Cần ít nhất 1 ảnh; Chon.Love khuyến nghị 3 ảnh để hồ sơ đáng tin cậy hơn."
      onBack={() => router.replace('/onboarding/looking-for')}
      step={6}
      testID="chon-onboarding-photos"
      title="Thêm ảnh của bạn"
    >
      <View style={styles.qualityCard}>
        <Text style={styles.qualityTitle}>Ảnh rõ nét, không giảm chất lượng không cần thiết</Text>
        <Text style={styles.qualityText}>
          JPEG, PNG và WebP hợp lệ dưới 10 MB được giữ nguyên dữ liệu ảnh khi upload. Ảnh quá lớn hoặc định dạng khác chỉ được chuyển đổi ở chất lượng cao để đáp ứng giới hạn lưu trữ; hệ thống không phóng to ảnh nhỏ.
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.countText}>{totalCount}/{SIGNUP_PROFILE_PHOTO_LIMIT} ảnh</Text>
        <Text style={[styles.recommendation, recommendedReached && styles.recommendationDone]}>
          {recommendedReached ? '✓ Đã đạt khuyến nghị 3 ảnh' : `Khuyến nghị ${SIGNUP_RECOMMENDED_PHOTO_COUNT} ảnh`}
        </Text>
      </View>

      <View style={styles.photoGrid} testID="signup-photo-grid">
        {slots.map((slot, index) => {
          const isPendingAvatar = slot?.kind === 'pending' && !hasAvatar && slot.pendingIndex === 0;
          const isAvatar = slot?.kind === 'existing' ? slot.photo.visibility === 'avatar' : isPendingAvatar;
          const uri = slot?.kind === 'existing' ? slot.photo.uri : slot?.kind === 'pending' ? slot.photo.previewUri : null;
          return (
            <View key={`photo-slot-${index}`} style={[styles.photoSlot, { width: compact ? '31%' : '18%' }]}>
              {uri ? (
                <Image
                  accessibilityLabel={isAvatar ? 'Ảnh đại diện' : `Ảnh hồ sơ ${index + 1}`}
                  resizeMode="cover"
                  source={{ uri }}
                  style={styles.photo}
                />
              ) : slot ? (
                <View style={styles.savedPlaceholder}>
                  <Text style={styles.savedIcon}>✓</Text>
                  <Text style={styles.savedText}>Ảnh đã lưu</Text>
                </View>
              ) : (
                <View style={styles.emptySlot}>
                  <Text style={styles.plus}>＋</Text>
                  <Text style={styles.emptyText}>Ảnh {index + 1}</Text>
                </View>
              )}
              {isAvatar ? <Text style={styles.avatarBadge}>Đại diện</Text> : null}
              {slot?.kind === 'pending' ? (
                <Pressable
                  accessibilityLabel={`Bỏ ảnh ${index + 1}`}
                  accessibilityRole="button"
                  disabled={isUploading}
                  onPress={() => removePending(slot.pendingIndex)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      <SignupHelpText tone={totalCount === 0 ? 'danger' : recommendedReached ? 'success' : 'muted'}>
        {totalCount === 0
          ? 'Cần ít nhất 1 ảnh để tiếp tục. Ảnh đầu tiên sẽ là ảnh đại diện.'
          : recommendedReached
            ? '✓ Ảnh đã sẵn sàng cho bước xác minh khuôn mặt.'
            : 'Bạn đã đủ điều kiện tối thiểu. Thêm 3 ảnh giúp tăng độ tin cậy và có thêm ảnh tham chiếu khi xác minh selfie.'}
      </SignupHelpText>

      <SignupSecondaryButton
        busy={isSelecting}
        disabled={remainingSlots <= 0 || isUploading}
        label={remainingSlots > 0 ? `Chọn ảnh từ thiết bị (${remainingSlots} ô còn lại)` : 'Đã đủ 5 ảnh'}
        onPress={() => void choosePhotos()}
      />

      {errorMessage ? <SignupHelpText tone="danger">{errorMessage}</SignupHelpText> : null}
      <SignupPrimaryButton
        busy={isUploading}
        disabled={!hasRequiredPhoto || isSelecting}
        label={pendingPhotos.length > 0 ? `Upload ${pendingPhotos.length} ảnh và tiếp tục` : 'Tiếp tục'}
        onPress={() => void continueNext()}
      />
    </SignupShell>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.lg },
  muted: { color: colors.muted, fontSize: 14 },
  qualityCard: { backgroundColor: '#FFF9EA', borderColor: '#E8D391', borderRadius: 12, borderWidth: 1, gap: 6, padding: spacing.md },
  qualityTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  qualityText: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  summaryRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  countText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  recommendation: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  recommendationDone: { color: '#15803D' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'flex-start' },
  photoSlot: { aspectRatio: 1, borderRadius: 12, minWidth: 92, overflow: 'hidden', position: 'relative' },
  photo: { height: '100%', width: '100%' },
  emptySlot: { alignItems: 'center', backgroundColor: '#FAFAFA', borderColor: colors.border, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, height: '100%', justifyContent: 'center', width: '100%' },
  plus: { color: colors.muted, fontSize: 28, lineHeight: 32 },
  emptyText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  savedPlaceholder: { alignItems: 'center', backgroundColor: '#F0FDF4', borderColor: '#86EFAC', borderRadius: 12, borderWidth: 1, height: '100%', justifyContent: 'center', width: '100%' },
  savedIcon: { color: '#15803D', fontSize: 24, fontWeight: '900' },
  savedText: { color: '#15803D', fontSize: 11, fontWeight: '700' },
  avatarBadge: { backgroundColor: 'rgba(17,17,17,0.78)', borderRadius: 999, color: '#FFFFFF', fontSize: 10, fontWeight: '800', left: 6, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, position: 'absolute', top: 6 },
  removeButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 999, height: 28, justifyContent: 'center', position: 'absolute', right: 6, top: 6, width: 28 },
  removeText: { color: colors.text, fontSize: 20, fontWeight: '800', lineHeight: 22 },
  signOutButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 48 },
  signOutText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});