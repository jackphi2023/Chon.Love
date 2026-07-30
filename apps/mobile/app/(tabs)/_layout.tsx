import { colors, spacing } from '@myfan/ui';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getAuthenticatedDestination } from '@/lib/auth';
import type { AuthenticatedRoute } from '@/lib/auth-routing';
import { logger } from '@/lib/logger';
import { useAuth } from '@/providers/auth-provider';

export default function TabsLayout() {
  const auth = useAuth();
  const [destination, setDestination] = useState<AuthenticatedRoute | null>(null);

  useEffect(() => {
    if (auth.isRestoring || !auth.userId) return;
    let active = true;
    void getAuthenticatedDestination()
      .then((route) => {
        if (active) setDestination(route);
      })
      .catch((error) => {
        logger.error('Unable to authorize protected tabs', error);
        if (active) setDestination('/(onboarding)');
      });
    return () => {
      active = false;
    };
  }, [auth.isRestoring, auth.userId]);

  if (auth.isRestoring) return <RouteLoading />;
  if (!auth.userId) return <Redirect href="/(auth)" />;
  if (destination === null) return <RouteLoading />;
  if (destination !== '/(tabs)') return <Redirect href="/(onboarding)" />;

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Khám phá' }} />
      <Tabs.Screen name="friends" options={{ title: 'Kết nối' }} />
      <Tabs.Screen name="gifts" options={{ title: 'Quà' }} />
      <Tabs.Screen name="balance" options={{ title: '❤️' }} />
      <Tabs.Screen name="profile" options={{ title: 'Hồ sơ' }} />
    </Tabs>
  );
}

function RouteLoading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.loadingText}>Đang kiểm tra quyền truy cập…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.background },
  loadingText: { color: colors.muted, fontSize: 14 },
});
