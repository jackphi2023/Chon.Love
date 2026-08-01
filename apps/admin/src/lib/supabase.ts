'use client';

import { createPublicSupabaseClient } from '@myfan/supabase';

type AdminSupabaseClient = ReturnType<typeof createPublicSupabaseClient>;
let cachedClient: AdminSupabaseClient | null | undefined;

export function getAdminSupabaseClient(): AdminSupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    cachedClient = null;
    return cachedClient;
  }
  cachedClient = createPublicSupabaseClient({ url, anonKey }, { persistSession: true });
  return cachedClient;
}
