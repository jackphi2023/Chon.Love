import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { type AuthSignOutScope } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { emitMobileRuntimeObservation } from '@/lib/runtime-observability';
import { getMobileSupabaseClient } from '@/lib/supabase';

type AuthContextValue = {
  userId: string | null;
  email: string | null;
  isRestoring: boolean;
  isConfigured: boolean;
  signOut: (scope?: AuthSignOutScope) => Promise<void>;
};

type RealtimeSession = { access_token: string } | null;

const AuthContext = createContext<AuthContextValue | null>(null);

async function synchronizeRealtimeSession(
  client: NonNullable<ReturnType<typeof getMobileSupabaseClient>>,
  session: RealtimeSession,
): Promise<void> {
  if (!session?.access_token) return;
  try {
    // Postgres Changes is protected by the same authenticated RLS as normal reads.
    // Synchronize the restored/signed-in JWT before UI keyed by userId can mount a
    // Realtime channel. This is especially important after a full browser navigation,
    // where Auth restores from storage before the mailbox subscription is recreated.
    await client.realtime.setAuth(session.access_token);
  } catch (error) {
    logger.error('Unable to synchronize Realtime auth session', error, { feature: 'realtime_auth' });
    emitMobileRuntimeObservation({
      eventName: 'realtime_auth_error',
      severity: 'warning',
      routeGroup: 'auth',
      error,
      metadata: { feature: 'realtime_auth' },
    });
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const client = useMemo(() => getMobileSupabaseClient(), []);

  useEffect(() => {
    if (!client) {
      setIsRestoring(false);
      return;
    }
    let mounted = true;
    void client.auth.getSession().then(async ({ data, error }) => {
      if (error) {
        logger.error('Unable to restore auth session', error, { feature: 'auth_restore' });
        emitMobileRuntimeObservation({ eventName: 'auth_restore_error', severity: 'warning', routeGroup: 'auth', error, metadata: { feature: 'auth_restore' } });
      }
      if (!mounted) return;
      if (!data.session) {
        setUserId(null);
        setEmail(null);
        setIsRestoring(false);
        return;
      }
      await synchronizeRealtimeSession(client, data.session);
      if (!mounted) return;
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) {
        logger.error('Unable to validate restored auth user', userError, { feature: 'auth_restore' });
        emitMobileRuntimeObservation({ eventName: 'auth_restore_error', severity: 'warning', routeGroup: 'auth', error: userError, metadata: { feature: 'auth_validation' } });
      }
      if (mounted) {
        setUserId(userData.user?.id ?? null);
        setEmail(userData.user?.email ?? null);
        setIsRestoring(false);
      }
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        await synchronizeRealtimeSession(client, session);
        if (!mounted) return;
        setUserId(session?.user.id ?? null);
        setEmail(session?.user.email ?? null);
        setIsRestoring(false);
      })();
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const signOut = useCallback(async (scope: AuthSignOutScope = 'global') => {
    if (!client) return;
    const { error } = await client.auth.signOut({ scope });
    if (error) throw error;
    if (scope !== 'others') {
      setUserId(null);
      setEmail(null);
    }
  }, [client]);

  const value = useMemo(
    () => ({ userId, email, isRestoring, isConfigured: client !== null, signOut }),
    [client, email, isRestoring, signOut, userId],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
