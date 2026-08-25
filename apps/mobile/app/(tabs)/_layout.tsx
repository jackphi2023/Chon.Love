import { colors, luxyColors, spacing } from '@myfan/ui';
import { Redirect, Slot, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { ChonAuthenticatedPageChrome } from '@/components/chon-authenticated-page-chrome';
import { getAuthenticatedDestination } from '@/lib/auth';
import type { AuthenticatedRoute } from '@/lib/auth-routing';
import { logger } from '@/lib/logger';
import { useAuth } from '@/providers/auth-provider';

const CONNECT_ACTIVATION_GRACE_DELAYS_MS = [200, 400] as const;

function shouldShowDesktopFooter(pathname: string): boolean {
  return pathname === '/connect'
    || pathname.startsWith('/favorites')
    || pathname.startsWith('/friends')
    || pathname.startsWith('/messages');
}

async function getProtectedDestination(): Promise<AuthenticatedRoute> {
  let destination = await getAuthenticatedDestination();
  if (destination === '/(tabs)/connect') return destination;

  // Selfie auto-approval activates the profile synchronously, but a freshly
  // completed transition may still observe the previous onboarding state for
  // a very short window. Re-check only while protected layout authorization is
  // being established; ordinary tab navigation does not re-run this effect.
  for (const delayMs of CONNECT_ACTIVATION_GRACE_DELAYS_MS) {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    destination = await getAuthenticatedDestination();
    if (destination === '/(tabs)/connect') break;
  }
  return destination;
}

export default function AuthenticatedLuxyLayout() {
  const auth = useAuth();
  const pathname = usePathname();
  const [destination, setDestination] = useState<AuthenticatedRoute | null>(null);

  useEffect(() => {
    if (auth.isRestoring || !auth.userId) return;
    let active = true;
    setDestination(null);
    void getProtectedDestination()
      .then((route) => {
        if (active) setDestination(route);
      })
      .catch((error) => {
        logger.error('Unable to authorize protected Chon.Love routes', error);
        if (active) setDestination('/(onboarding)');
      });
    return () => {
      active = false;
    };
  }, [auth.isRestoring, auth.userId]);

  if (auth.isRestoring) return <RouteLoading />;
  if (!auth.userId) return Platform.OS === 'web' ? <PublicHomepageReload /> : <Redirect href="/" />;
  if (destination === null) return <RouteLoading />;
  if (destination !== '/(tabs)/connect') return <Redirect href="/(onboarding)" />;

  return (
    <ChonAuthenticatedPageChrome
      footer={shouldShowDesktopFooter(pathname) ? 'desktop' : 'none'}
      testID="chon-tabs-page-chrome"
    >
      <Slot />
    </ChonAuthenticatedPageChrome>
  );
}

function PublicHomepageReload() {
  useEffect(() => {
    if (typeof window !== 'undefined') window.location.replace('/');
  }, []);
  return <RouteLoading />;
}

function RouteLoading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator accessibilityLabel="Đang tải" accessibilityRole="progressbar" color={colors.primary} size="large" />
      <Text accessibilityLiveRegion="polite" style={styles.loadingText}>Đang kiểm tra quyền truy cập…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: luxyColors.background, flex: 1, gap: spacing.md, justifyContent: 'center' },
  loadingText: { color: colors.muted, fontSize: 14 },
});
