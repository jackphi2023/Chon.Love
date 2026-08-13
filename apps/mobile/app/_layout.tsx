import '@/lib/style-sheet-compat';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppErrorBoundary } from '@/components/app-error-boundary';
import { AppProviders } from '@/providers/app-providers';

const WEB_TITLE = 'Chon.Love | Chọn đúng người, Yêu đúng Gu';

function WebDocumentMetadata() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.lang = 'vi';
    document.title = WEB_TITLE;
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <WebDocumentMetadata />
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    </AppErrorBoundary>
  );
}
