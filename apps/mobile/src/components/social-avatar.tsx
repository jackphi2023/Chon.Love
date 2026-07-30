import { createPrivateMediaUrl } from '@myfan/supabase';
import { colors } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';

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
    queryKey: ['social-avatar', mediaId],
    enabled: Boolean(client && mediaId && storageBucket && storagePath),
    staleTime: 45_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!client || !storageBucket || !storagePath) return null;
      return createPrivateMediaUrl(client, { storage_bucket: storageBucket, storage_path: storagePath });
    },
  });

  const style = { width: size, height: size, borderRadius: size / 2 };
  if (urlQuery.data) {
    return <Image accessibilityLabel={`Ảnh đại diện của ${name}`} source={{ uri: urlQuery.data }} style={[styles.avatar, style]} />;
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
