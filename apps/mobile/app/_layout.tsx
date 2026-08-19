import '@/lib/style-sheet-compat';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppErrorBoundary } from '@/components/app-error-boundary';
import { MemberProfileMobileActions } from '@/components/member-profile-mobile-actions';
import { MemberProfileVerificationBadges } from '@/components/member-profile-verification-badges';
import { AppProviders } from '@/providers/app-providers';
import { useAuth } from '@/providers/auth-provider';

const TITLE_SUFFIX = 'Chọn.love - Chọn đúng Người, Yêu đúng Gu';

function isGuestPublicPath(pathname: string): boolean {
  return pathname === '/'
    || pathname === '/auth'
    || pathname.startsWith('/auth/')
    || pathname.startsWith('/legal/')
    || pathname.startsWith('/thanh-vien/');
}

function staticPublicTitle(pathname: string): string | null {
  if (pathname === '/') return `Trang chủ | ${TITLE_SUFFIX}`;
  if (pathname === '/auth') {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'login') {
      return `Đăng nhập | ${TITLE_SUFFIX}`;
    }
    return `Đăng ký | ${TITLE_SUFFIX}`;
  }
  if (pathname === '/auth/forgot-password') return `Quên mật khẩu | ${TITLE_SUFFIX}`;
  if (pathname === '/auth/reset-password') return `Đặt lại mật khẩu | ${TITLE_SUFFIX}`;
  if (pathname === '/auth/callback') return `Xác thực tài khoản | ${TITLE_SUFFIX}`;
  if (pathname === '/legal/terms') return `Điều khoản | ${TITLE_SUFFIX}`;
  if (pathname === '/legal/community-standards') return `Tiêu chuẩn cộng đồng | ${TITLE_SUFFIX}`;
  if (pathname.startsWith('/thanh-vien/')) return null;
  return `Chọn.love | Chọn đúng Người, Yêu đúng Gu`;
}

function WebDocumentMetadata() {
  const pathname = usePathname();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.lang = 'vi';
    const title = staticPublicTitle(pathname);
    if (title) document.title = title;
  }, [pathname]);

  return null;
}

function RootNavigator() {
  const pathname = usePathname();
  const auth = useAuth();

  if (auth.isRestoring) return null;
  if (!auth.userId && !isGuestPublicPath(pathname)) return <Redirect href="/" />;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <MemberProfileVerificationBadges />
      <MemberProfileMobileActions />
    </>
  );
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <WebDocumentMetadata />
        <StatusBar style="auto" />
        <RootNavigator />
      </AppProviders>
    </AppErrorBoundary>
  );
}