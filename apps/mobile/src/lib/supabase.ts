import { createPublicSupabaseClient } from '@myfan/supabase';
import { getMobileEnvironmentStatus } from './environment';
import { mobileAuthStorage } from './auth-storage';

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
      persistSession: true,
      ...(mobileAuthStorage ? { storage: mobileAuthStorage } : {}),
      allowInsecureLocalhost: environment.appEnvironment === 'development',
    },
  );
  return cachedClient;
}
