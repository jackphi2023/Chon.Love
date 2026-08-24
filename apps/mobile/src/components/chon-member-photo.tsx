import { createPublicProfileMediaUrl, type LuxyMembershipTier } from '@myfan/supabase';
import { chonColors, luxyTypography } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { ChonMembershipBadge } from './chon-membership-badge';
import { ChonPhotoCount } from './chon-photo-count';
import { LazyProfileImage } from './lazy-profile-image';

const PUBLIC_PHOTO_STALE_TIME_MS = 55 * 60_000;
const PUBLIC_PHOTO_GC_TIME_MS = 2 * 60 * 60_000;

type PhotoCountPlacement = 'top-right' | 'bottom-right';

export function ChonMemberPhoto({
  mediaId,
  storageBucket,
  storagePath,
  name,
  photoCount,
  membershipTier,
  desktop = false,
  photoCountPlacement = 'top-right',
  showZeroPhotoCount = false,
  badgeInset,
  fallbackFontSize,
  style,
  children,
  testID = 'chon-member-photo',
}: {
  mediaId: string | null;
  storageBucket: string | null;
  storagePath: string | null;
  name: string;
  photoCount?: number | null | undefined;
  membershipTier?: LuxyMembershipTier | null | undefined;
  desktop?: boolean | undefined;
  photoCountPlacement?: PhotoCountPlacement | undefined;
  showZeroPhotoCount?: boolean | undefined;
  badgeInset?: number | undefined;
  fallbackFontSize?: number | undefined;
  style?: StyleProp<ViewStyle> | undefined;
  children?: ReactNode | undefined;
  testID?: string | undefined;
}) {
  const client = getMobileSupabaseClient();
  const imageQuery = useQuery({
    queryKey: ['chon-member-photo', mediaId, storagePath],
    enabled: Boolean(client && mediaId && storageBucket && storagePath),
    staleTime: PUBLIC_PHOTO_STALE_TIME_MS,
    gcTime: PUBLIC_PHOTO_GC_TIME_MS,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!client || !storageBucket || !storagePath) return null;
      return createPublicProfileMediaUrl(client, {
        storage_bucket: storageBucket,
        storage_path: storagePath,
      });
    },
  });

  const shouldShowPhotoCount = typeof photoCount === 'number' && (showZeroPhotoCount || photoCount > 0);

  return (
    <View style={[styles.frame, style]} testID={testID}>
      {imageQuery.data ? (
        <LazyProfileImage
          accessibilityLabel={`Ảnh hồ sơ của ${name}`}
          resizeMode="cover"
          source={{ uri: imageQuery.data }}
          style={styles.image}
        />
      ) : (
        <View accessibilityLabel={`Chưa có ảnh hồ sơ của ${name}`} style={styles.fallback}>
          <Text style={[styles.initial, fallbackFontSize ? { fontSize: fallbackFontSize } : null]}>
            {name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}

      <ChonMembershipBadge
        desktop={desktop}
        inset={badgeInset ?? (desktop ? 8 : 7)}
        tier={membershipTier}
        variant="icon"
      />

      {shouldShowPhotoCount ? (
        <View
          style={[
            styles.photoCount,
            photoCountPlacement === 'bottom-right' ? styles.photoCountBottom : styles.photoCountTop,
            desktop && photoCountPlacement === 'top-right' ? styles.photoCountTopDesktop : null,
          ]}
        >
          <ChonPhotoCount count={photoCount} />
        </View>
      ) : null}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: chonColors.warmSurface,
    overflow: 'hidden',
    position: 'relative',
  },
  image: { height: '100%', width: '100%' },
  fallback: {
    alignItems: 'center',
    backgroundColor: '#E7E5E4',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  initial: {
    color: chonColors.muted,
    fontFamily: luxyTypography.families.display,
    fontSize: 34,
  },
  photoCount: { position: 'absolute', right: 7, zIndex: 7 },
  photoCountTop: { top: 8 },
  photoCountTopDesktop: { right: 8, top: 9 },
  photoCountBottom: { bottom: 5, right: 5 },
});
