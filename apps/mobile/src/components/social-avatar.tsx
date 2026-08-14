import { createPublicProfileMediaUrl } from '@myfan/supabase';
import { colors } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { LazyProfileImage } from './lazy-profile-image';

const PUBLIC_PHOTO_STALE_TIME_MS = 55 * 60_000;
const PUBLIC_PHOTO_GC_TIME_MS = 2 * 60 * 60_000;

export function SocialAvatar({
  mediaId,
  storageBucket,
  storagePath,
  name,
  size = 64,
}: {
  mediaId: string | null;
  storageBucket: string | null;
  storagePath: string | null;
  name: string;
  size?: number;
}) {
  const client = getMobileSupabaseClient();
  const urlQuery = useQuery({
    queryKey: ['social-avatar', mediaId, storagePath],
    enabled: Boolean(client && mediaId && storageBucket && storagePath),
    staleTime: PUBLIC_PHOTO_STALE_TIME_MS,
    gcTime: PUBLIC_PHOTO_GC_TIME_MS,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!client || !storageBucket || !storagePath) return null;
      return createPublicProfileMediaUrl(client, { storage_bucket: storageBucket, storage_path: storagePath });
    },
  });

  const style = { width: size, height: size, borderRadius: size / 2 };
  if (urlQuery.data) {
    return <LazyProfileImage accessibilityLabel={`Ảnh đại diện của ${name}`} resizeMode="cover" source={{ uri: urlQuery.data }} style={[styles.avatar, style]} />;
  }
  return (
    <View accessibilityLabel={`Chưa có ảnh đại diện của ${name}`} style={[styles.fallback, style]}>
      <Text style={[styles.initial, { fontSize: Math.max(18, size * 0.36) }]}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: colors.border },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FCE7F3' },
  initial: { color: colors.primary, fontWeight: '900' },
});
