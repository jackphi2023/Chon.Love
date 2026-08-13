import { createPrivateMediaUrl, type LuxyMembershipTier } from '@myfan/supabase';
import { luxyColors, luxyTypography } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { LuxyMembershipBadgeImage } from './luxy-membership-badge-image';

export function LuxySeekingMemberPhoto({
  mediaId,
  storageBucket,
  storagePath,
  name,
  photoCount,
  membershipTier,
  width = 84,
  height = 112,
}: {
  mediaId: string | null;
  storageBucket: string | null;
  storagePath: string | null;
  name: string;
  photoCount?: number | null;
  membershipTier?: LuxyMembershipTier | null;
  width?: number;
  height?: number;
}) {
  const client = getMobileSupabaseClient();
  const imageQuery = useQuery({
    queryKey: ['luxy-seeking-row-photo', mediaId],
    enabled: Boolean(client && mediaId && storageBucket && storagePath),
    staleTime: 45_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!client || !storageBucket || !storagePath) return null;
      return createPrivateMediaUrl(client, { storage_bucket: storageBucket, storage_path: storagePath });
    },
  });

  const frameStyle = { width, height };
  const badgeWidth = Math.max(46, Math.min(64, Math.round(width * 0.68)));
  return (
    <View style={[styles.frame, frameStyle]}>
      {imageQuery.data ? (
        <Image
          accessibilityLabel={`Ảnh hồ sơ của ${name}`}
          resizeMode="cover"
          source={{ uri: imageQuery.data }}
          style={styles.image}
        />
      ) : (
        <View accessibilityLabel={`Chưa có ảnh hồ sơ của ${name}`} style={styles.fallback}>
          <Text style={styles.initial}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <LuxyMembershipBadgeImage tier={membershipTier} width={badgeWidth} />
      {typeof photoCount === 'number' && photoCount > 0 ? (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>▣ {photoCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#E8E8E8',
    borderRadius: 7,
    flexShrink: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  image: { height: '100%', width: '100%' },
  fallback: { alignItems: 'center', backgroundColor: '#E7E5E4', flex: 1, justifyContent: 'center' },
  initial: { color: luxyColors.muted, fontFamily: luxyTypography.families.display, fontSize: 34 },
  countBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(8,23,38,0.78)',
    borderRadius: 4,
    bottom: 5,
    minHeight: 19,
    paddingHorizontal: 5,
    position: 'absolute',
    right: 5,
    zIndex: 7,
  },
  countText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700', lineHeight: 18 },
});
