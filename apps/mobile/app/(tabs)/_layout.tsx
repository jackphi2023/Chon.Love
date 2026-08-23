import { colors, luxyBreakpoints, luxyColors, spacing } from '@myfan/ui';
import { Redirect, Slot, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LuxyDesktopFooter } from '@/components/luxy-desktop-footer';
import { LuxyDesktopNavigation } from '@/components/luxy-desktop-navigation';
import { LuxyShellNavigation } from '@/components/luxy-shell-navigation';
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

async function getProtectedDestination(pathname: string): Promise<AuthenticatedRoute> {
  let destination = await getAuthenticatedDestination();
  if (pathname !== '/connect' || destination === '/(tabs)/connect') return destination;

  // Selfie auto-approval activates the profile synchronously, but a freshly
  // completed web transition may still observe the previous onboarding state
  // for a very short window. Re-check only the Connect entry path instead of
  // bouncing an approved member back into onboarding immediately.
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
  const { width } = useWindowDimensions();
  const [destination, setDestination] = useState<AuthenticatedRoute | null>(null);
  const desktop = width >= luxyBreakpoints.desktop;

  useEffect(() => {
    if (auth.isRestoring || !auth.userId) return;
    let active = true;
    setDestination(null);
    void getProtectedDestination(pathname)
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
  }, [auth.isRestoring, auth.userId, pathname]);

  if (auth.isRestoring) return <RouteLoading />;
  if (!auth.userId) return Platform.OS === 'web' ? <PublicHomepageReload /> : <Redirect href="/" />;
  if (destination === null) return <RouteLoading />;
  if (destination !== '/(tabs)/connect') return <Redirect href="/(onboarding)" />;

  return (
    <View style={styles.shell}>
      {desktop ? <LuxyDesktopNavigation /> : <LuxyShellNavigation />}
      <View style={styles.routeContent}><Slot /></View>
      {desktop && shouldShowDesktopFooter(pathname) ? <LuxyDesktopFooter /> : null}
    </View>
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
  shell: { backgroundColor: luxyColors.background, flex: 1 },
  routeContent: { backgroundColor: luxyColors.background, flex: 1, minHeight: 0 },
  loading: { alignItems: 'center', backgroundColor: luxyColors.background, flex: 1, gap: spacing.md, justifyContent: 'center' },
  loadingText: { color: colors.muted, fontSize: 14 },
});