import { resolveChonMemberRoute, toPublicMemberPath } from '@myfan/supabase';
import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

function normalizeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function LegacyUsernameProfileRedirect() {
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const username = normalizeParam(params.username).trim();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const router = useRouter();

  const routeQuery = useQuery({
    queryKey: ['legacy-member-route', auth.userId, username],
    enabled: Boolean(client && auth.userId && username),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!client) return null;
      return resolveChonMemberRoute(client, username);
    },
  });

  useEffect(() => {
    const code = routeQuery.data?.public_profile_code;
    if (code) router.replace(toPublicMemberPath(code));
  }, [routeQuery.data?.public_profile_code, router]);

  if (!auth.isRestoring && !auth.userId) return <Redirect href="/" />;
  if (!username || routeQuery.isError || (!routeQuery.isLoading && !routeQuery.data)) return <Redirect href="/" />;

  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" />
      <Text style={styles.copy}>Đang mở hồ sơ thành viên…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  copy: { color: '#6B7280', fontSize: 13 },
});