'use client';

import { createPublicSupabaseClient } from '@myfan/supabase';
import { getPublicWebEnvironmentStatus } from './environment';

type PublicWebSupabaseClient = ReturnType<typeof createPublicSupabaseClient>;
let cachedClient: PublicWebSupabaseClient | null | undefined;

export function getPublicWebSupabaseClient(): PublicWebSupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const environment = getPublicWebEnvironmentStatus();
  if (!environment.supabaseConfigured || !environment.supabaseUrl || !environment.supabaseAnonKey) {
    cachedClient = null;
    return cachedClient;
  }
  cachedClient = createPublicSupabaseClient({
    url: environment.supabaseUrl,
    anonKey: environment.supabaseAnonKey,
  });
  return cachedClient;
}
