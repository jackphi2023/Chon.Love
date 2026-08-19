'use client';

import { createPublicSupabaseClient } from '@myfan/supabase';

type AdminSupabaseClient = ReturnType<typeof createPublicSupabaseClient>;
type AdminRoleRpcResult = { data: boolean | null; error: { message: string } | null };
type AdminRoleRpcClient = {
  rpc: (functionName: 'is_super_admin') => Promise<AdminRoleRpcResult>;
};

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

export async function isCurrentUserSuperAdmin(client: AdminSupabaseClient): Promise<boolean> {
  // The live database exposes is_super_admin() but the checked-in generated Database
  // types can lag production migrations. Keep this compatibility cast isolated here.
  const rpcClient = client as unknown as AdminRoleRpcClient;
  const { data, error } = await rpcClient.rpc('is_super_admin');
  return !error && data === true;
}
