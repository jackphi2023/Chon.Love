import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppErrorBoundary } from '@/components/app-error-boundary';
import { AppProviders } from '@/providers/app-providers';

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    </AppErrorBoundary>
  );
}
