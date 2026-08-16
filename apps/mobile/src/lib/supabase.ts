import { createPublicSupabaseClient } from '@myfan/supabase';
import { Platform } from 'react-native';
import { getMobileEnvironmentStatus } from './environment';

type MobileSupabaseClient = ReturnType<typeof createPublicSupabaseClient>;

let cachedClient: MobileSupabaseClient | null | undefined;

export function getMobileSupabaseClient(): MobileSupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const environment = getMobileEnvironmentStatus();
  if (!environment.supabaseConfigured || !environment.supabaseUrl || !environment.supabaseAnonKey) {
    cachedClient = null;
    return cachedClient;
  }
  const isWeb = Platform.OS === 'web';
  cachedClient = createPublicSupabaseClient(
    { url: environment.supabaseUrl, anonKey: environment.supabaseAnonKey },
    {
      // Chon.Love Web is a client-only Expo SPA. Supabase's implicit flow lets
      // email-confirmation and recovery links establish the browser session
      // directly after the redirect. Native keeps PKCE for future/deferred use.
      flowType: isWeb ? 'implicit' : 'pkce',
      detectSessionInUrl: isWeb,
      persistSession: isWeb,
      allowInsecureLocalhost: environment.appEnvironment === 'development',
    },
  );
  return cachedClient;
}
