import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

type AuthContextValue = {
  userId: string | null;
  isRestoring: boolean;
  isConfigured: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const client = useMemo(() => getMobileSupabaseClient(), []);

  useEffect(() => {
    if (!client) {
      setIsRestoring(false);
      return;
    }
    let mounted = true;
    void client.auth.getSession().then(({ data, error }) => {
      if (error) logger.error('Unable to restore auth session', error);
      if (mounted) {
        setUserId(data.session?.user.id ?? null);
        setIsRestoring(false);
      }
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setIsRestoring(false);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo(
    () => ({ userId, isRestoring, isConfigured: client !== null }),
    [client, isRestoring, userId],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
