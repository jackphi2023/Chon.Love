import {
  createPrivateMediaUrl,
  getMyLuxyMembershipSnapshot,
  getPrivatePhotoAccessState,
  getReadablePrivatePhotoError,
  listProfilePrivateMedia,
} from '@myfan/supabase';
import { chonColors, chonShadows, chonTypography } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type Variant = 'button' | 'tile';
type PrivatePhotoWithUrl = { media_id: string; url: string };

export function ChonPrivatePhotoAccess({
  ownerId,
  displayName,
  privatePhotoCount,
  variant,
  onOpenPhoto,
}: {
  ownerId: string;
  displayName: string;
  privatePhotoCount: number;
  variant: Variant;
  onOpenPhoto: (url: string | null) => void;
}) {
  const client = getMobileSupabaseClient();
  const auth = useAuth();
  const router = useRouter();

  const membershipQuery = useQuery({
    queryKey: ['luxy-membership', auth.userId],
    enabled: Boolean(client && auth.userId),
    staleTime: 20_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyLuxyMembershipSnapshot(client);
    },
  });

  const accessQuery = useQuery({
    queryKey: ['private-photo-access', auth.userId, ownerId],
    enabled: Boolean(client && auth.userId && ownerId && privatePhotoCount > 0),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getPrivatePhotoAccessState(client, ownerId);
    },
  });

  const isPaid = membershipQuery.data?.tier === 'premium' || membershipQuery.data?.tier === 'diamond';
  const privateMediaQuery = useQuery({
    queryKey: ['private-photo-media', auth.userId, ownerId],
    enabled: Boolean(client && isPaid && accessQuery.data?.has_access),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client) return [] as PrivatePhotoWithUrl[];
      const rows = await listProfilePrivateMedia(client, ownerId);
      return Promise.all(rows.map(async (media) => ({
        media_id: media.media_id,
        url: await createPrivateMediaUrl(client, {
          storage_bucket: media.storage_bucket,
          storage_path: media.storage_path,
        }),
      })));
    },
  });

  if (privatePhotoCount <= 0) return null;

  function openMembership() {
    router.push({ pathname: '/settings/membership', params: { plan: 'premium', source: 'member_profile_private_photo' } });
  }

  const error = accessQuery.error ?? privateMediaQuery.error;
  const count = accessQuery.data?.private_photo_count ?? privatePhotoCount;

  if (variant === 'tile') {
    return (
      <>
        {isPaid && privateMediaQuery.data?.length ? privateMediaQuery.data.map((media) => (
          <Pressable
            accessibilityLabel={`Xem ảnh riêng tư của ${displayName}`}
            accessibilityRole="button"
            key={media.media_id}
            onPress={() => onOpenPhoto(media.url)}
            style={({ pressed }) => [styles.approvedTile, pressed && styles.pressed]}
            testID="chon-private-photo-paid-tile"
          >
            <Image accessibilityLabel={`Ảnh riêng tư của ${displayName}`} resizeMode="cover" source={{ uri: media.url }} style={styles.approvedImage} />
            <View style={styles.privateBadge}><Text style={styles.privateBadgeText}>Ảnh riêng tư</Text></View>
          </Pressable>
        )) : (
          <Pressable
            accessibilityLabel={isPaid ? `Đang tải ${count} ảnh riêng tư của ${displayName}` : `${count} ảnh riêng tư, cần nâng cấp để xem`}
            accessibilityRole="button"
            disabled={isPaid || membershipQuery.isLoading}
            onPress={openMembership}
            style={({ pressed }) => [styles.privateTile, pressed && !isPaid && styles.pressed]}
            testID="chon-private-photo-locked-tile"
          >
            {membershipQuery.isLoading || accessQuery.isLoading ? <ActivityIndicator color={chonColors.ink} /> : (
              <View style={styles.lockMark}><Text style={styles.lockMarkText}>Ảnh riêng tư ({count})</Text></View>
            )}
            <Text style={styles.privateTileBody}>
              {isPaid ? 'Đang tải ảnh dành cho thành viên trả phí…' : 'Thành viên Premium và Diamond được xem đầy đủ.'}
            </Text>
            {!isPaid ? <Text style={styles.privateTileButton}>Nâng cấp để xem</Text> : null}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{getReadablePrivatePhotoError(error)}</Text> : null}
          </Pressable>
        )}
      </>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        disabled={isPaid || membershipQuery.isLoading}
        onPress={openMembership}
        style={({ pressed }) => [styles.privateRequestButton, pressed && !isPaid && styles.pressed]}
        testID="chon-private-photo-entitlement-button"
      >
        <Text style={styles.privateRequestText}>
          {isPaid ? `Xem ${count} ảnh riêng tư` : `Xem ảnh riêng tư (${count}) · Nâng cấp`}
        </Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.errorInline}>{getReadablePrivatePhotoError(error)}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  privateRequestButton: {
    alignItems: 'center',
    backgroundColor: chonColors.surface,
    borderColor: chonColors.gold,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  privateRequestText: { color: chonColors.text, fontSize: chonTypography.sizes.body, fontWeight: '700', textAlign: 'center' },
  privateTile: {
    alignItems: 'center',
    backgroundColor: chonColors.warmSurface,
    borderColor: chonColors.gold,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 250,
    padding: 16,
    width: 240,
    ...chonShadows.card,
  },
  lockMark: { borderColor: chonColors.goldStrong, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  lockMarkText: { color: chonColors.goldStrong, fontSize: chonTypography.sizes.help, fontWeight: '800', letterSpacing: 0.7 },
  privateTileBody: { color: chonColors.muted, fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body, textAlign: 'center' },
  privateTileButton: { color: chonColors.primaryRed, fontSize: chonTypography.sizes.body, fontWeight: '700', textAlign: 'center' },
  approvedTile: { backgroundColor: chonColors.ink, borderRadius: 12, minHeight: 250, overflow: 'hidden', position: 'relative', width: 240 },
  approvedImage: { height: 250, width: '100%' },
  privateBadge: { backgroundColor: chonColors.overlay, borderRadius: 999, left: 9, paddingHorizontal: 9, paddingVertical: 5, position: 'absolute', top: 9 },
  privateBadgeText: { color: chonColors.surface, fontSize: chonTypography.sizes.help, fontWeight: '700' },
  error: { color: chonColors.danger, fontSize: chonTypography.sizes.help, lineHeight: chonTypography.lineHeights.help, textAlign: 'center' },
  errorInline: { color: chonColors.danger, fontSize: chonTypography.sizes.help, lineHeight: chonTypography.lineHeights.help, marginTop: 5 },
  pressed: { opacity: 0.76 },
});
