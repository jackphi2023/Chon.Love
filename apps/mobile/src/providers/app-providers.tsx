import {
  isTransientRuntimeError,
  publicHomepageQueryKeys,
  runtimeRetryDelayMs,
  shouldRetryRuntimeRequest,
} from '@myfan/supabase';
import {
  focusManager,
  onlineManager,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { emitMobileRuntimeObservation } from '@/lib/runtime-observability';
import { AuthProvider } from './auth-provider';

const HOMEPAGE_SETTINGS_REFRESH_MS = 30_000;

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError(error, query) {
            if (query.state.data !== undefined) return;
            emitMobileRuntimeObservation({
              eventName: 'query_retry_exhausted',
              severity: 'warning',
              routeGroup: 'query',
              error,
              metadata: {
                source: 'tanstack_query',
                retryable: isTransientRuntimeError(error),
              },
            });
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => shouldRetryRuntimeRequest(failureCount, error, 'read'),
            retryDelay: (attemptIndex) => runtimeRetryDelayMs(attemptIndex),
            refetchOnReconnect: true,
            refetchOnWindowFocus: true,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      focusManager.setFocused(status === 'active');
      if (status === 'active') {
        void queryClient.invalidateQueries({ queryKey: publicHomepageQueryKeys.settings });
      }
    });
    return () => subscription.remove();
  }, [queryClient]);

  useEffect(() => {
    // Homepage image/video settings are operator-managed content. The homepage
    // query intentionally has a long local staleTime for startup performance,
    // so invalidate this one small settings query on a bounded interval to make
    // Admin publications visible without asking visitors to hard-refresh.
    const timer = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: publicHomepageQueryKeys.settings });
    }, HOMEPAGE_SETTINGS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [queryClient]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const handleOffline = () => {
      onlineManager.setOnline(false);
      emitMobileRuntimeObservation({
        eventName: 'network_offline',
        severity: 'warning',
        routeGroup: 'root',
        metadata: { network_state: 'offline', source: 'browser_event' },
      });
    };
    const handleOnline = () => {
      onlineManager.setOnline(true);
      emitMobileRuntimeObservation({
        eventName: 'network_recovered',
        severity: 'info',
        routeGroup: 'root',
        metadata: { network_state: 'online', recovered: true, source: 'browser_event' },
      });
      void queryClient.invalidateQueries({ queryKey: publicHomepageQueryKeys.settings });
    };
    const handleFocus = () => {
      void queryClient.invalidateQueries({ queryKey: publicHomepageQueryKeys.settings });
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    onlineManager.setOnline(window.navigator.onLine);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}