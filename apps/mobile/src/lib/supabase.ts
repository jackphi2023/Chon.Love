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
  cachedClient = createPublicSupabaseClient(
    { url: environment.supabaseUrl, anonKey: environment.supabaseAnonKey },
    {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: Platform.OS === 'web',
      allowInsecureLocalhost: environment.appEnvironment === 'development',
    },
  );
  return cachedClient;
}
