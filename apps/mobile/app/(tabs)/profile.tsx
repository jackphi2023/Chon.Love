import {
  createPrivateMediaUrl,
  getMediaById,
  getMyProfile,
  isMediaHiddenByModeration,
  listMyMedia,
  listProfileAlbumMedia,
  uploadProfileImage,
} from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '@/components/screen';
import {
  getReadableProfileMediaError,
  pickAndPrepareProfileImage,
  type ProfileImageSource,
} from '@/lib/profile-media';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const profileQueryKey = (userId: string | null) => ['profile', 'me', userId] as const;
const mediaQueryKey = (userId: string | null) => ['profile', 'media', userId] as const;
const albumQueryKey = (userId: string | null) => ['profile', 'album', userId, 'public'] as const;

export default function Page() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const [uploading, setUploading] = useState<'avatar' | 'public' | null>(null);
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
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
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

  const publicAlbumQuery = useQuery({
    queryKey: albumQueryKey(auth.userId),
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client || !auth.userId) return [];
      const rows = await listProfileAlbumMedia(client, auth.userId, 'public');
      return Promise.all(
        rows.map(async (row) => ({ ...row, url: await createPrivateMediaUrl(client, row) })),
      );
    },
  });

  async function refreshProfile() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: profileQueryKey(auth.userId) }),
      queryClient.invalidateQueries({ queryKey: mediaQueryKey(auth.userId) }),
      queryClient.invalidateQueries({ queryKey: albumQueryKey(auth.userId) }),
      queryClient.invalidateQueries({ queryKey: ['profile', 'avatar-url'] }),
    ]);
  }

  async function handleUpload(
    visibility: 'avatar' | 'public',
    source: ProfileImageSource,
  ) {
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
      setMessage(visibility === 'avatar' ? 'Ảnh đại diện đã được cập nhật.' : 'Ảnh đã được đăng.');
    } catch (error) {
      setErrorMessage(getReadableProfileMediaError(error));
    } finally {
      setUploading(null);
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
      <Screen title="Hồ sơ của tôi" description="Đang tải hồ sơ an toàn của bạn.">
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  const profile = profileQuery.data;
  const hiddenMediaCount = (mediaQuery.data ?? []).filter(isMediaHiddenByModeration).length;

  return (
    <Screen
      title="Hồ sơ của tôi"
      description="Chia sẻ thông tin và hình ảnh phù hợp với cộng đồng MyFan 18+."
    >
      <View style={styles.profileHeader}>
        {avatarUrlQuery.data ? (
          <Image accessibilityLabel="Ảnh đại diện" source={{ uri: avatarUrlQuery.data }} style={styles.avatar} />
        ) : (
          <View accessibilityLabel="Chưa có ảnh đại diện" style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>
              {(profile?.display_name ?? profile?.username ?? 'M').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.identity}>
          <Text style={styles.displayName}>{profile?.display_name || 'Hoàn thiện hồ sơ'}</Text>
          <Text style={styles.username}>{profile?.username ? `@${profile.username}` : 'Chưa có username'}</Text>
          {profile?.is_creator ? <Text style={styles.creatorBadge}>Creator</Text> : null}
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          disabled={uploading !== null}
          onPress={() => handleUpload('avatar', 'library')}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Chọn avatar</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={uploading !== null}
          onPress={() => handleUpload('avatar', 'camera')}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Chụp avatar</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/profile/edit')}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>Chỉnh sửa hồ sơ</Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Giới thiệu</Text>
        <Text style={styles.bodyText}>{profile?.bio || 'Chưa có phần giới thiệu.'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sở thích</Text>
        <View style={styles.chipRow}>
          {(profile?.interests ?? []).length ? (
            profile?.interests.map((interest) => (
              <View key={interest} style={styles.chip}>
                <Text style={styles.chipText}>{interest}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.bodyText}>Chưa thêm sở thích.</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>Ảnh công khai</Text>
          <Pressable
            accessibilityRole="button"
            disabled={uploading !== null}
            onPress={() => handleUpload('public', 'library')}
          >
            <Text style={styles.textAction}>{uploading === 'public' ? 'Đang đăng…' : 'Thêm ảnh'}</Text>
          </Pressable>
        </View>
        <View style={styles.gallery}>
          {(publicAlbumQuery.data ?? []).map((item) => (
            <Image
              accessibilityLabel="Ảnh công khai của tôi"
              key={item.media_id}
              source={{ uri: item.url }}
              style={styles.galleryImage}
            />
          ))}
        </View>
        {!publicAlbumQuery.isLoading && !(publicAlbumQuery.data ?? []).length ? (
          <Text style={styles.bodyText}>Chưa có ảnh công khai.</Text>
        ) : null}
      </View>

      {hiddenMediaCount > 0 ? (
        <View style={styles.hiddenNotice}>
          <Text style={styles.hiddenNoticeText}>
            {hiddenMediaCount} ảnh đã bị ẩn vì không còn phù hợp với Tiêu chuẩn cộng đồng.
          </Text>
        </View>
      ) : null}

      {uploading ? <ActivityIndicator color={colors.primary} /> : null}
      {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
      {errorMessage || profileQuery.error || publicAlbumQuery.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {errorMessage ?? 'Không thể tải đầy đủ hồ sơ. Hãy thử lại.'}
        </Text>
      ) : null}

      <Pressable accessibilityRole="button" onPress={handleSignOut} style={styles.signOutButton}>
        <Text style={styles.signOutText}>Đăng xuất</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.border },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: colors.primary, fontSize: 32, fontWeight: '800' },
  identity: { flex: 1, gap: spacing.xs },
  displayName: { color: colors.text, fontSize: 22, fontWeight: '800' },
  username: { color: colors.muted, fontSize: 14 },
  creatorBadge: {
    alignSelf: 'flex-start',
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  primaryButton: {
    minHeight: 48,
    marginTop: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  bodyText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderRadius: 999, backgroundColor: '#FCE7F3', paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  textAction: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  galleryImage: { width: 94, height: 94, borderRadius: 12, backgroundColor: colors.border },
  hiddenNotice: { marginTop: spacing.lg, borderRadius: 12, backgroundColor: '#FEF2F2', padding: spacing.md },
  hiddenNoticeText: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  success: { color: '#166534', fontSize: 14, marginTop: spacing.md },
  error: { color: colors.danger, fontSize: 14, marginTop: spacing.md },
  signOutButton: {
    minHeight: 48,
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
