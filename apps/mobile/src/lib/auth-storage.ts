import type { SupabaseAuthStorage } from '@myfan/supabase';

/**
 * Web uses Supabase's browser storage. Metro resolves auth-storage.native.ts on
 * Android/iOS so native session tokens never fall back to browser storage.
 */
export const mobileAuthStorage: SupabaseAuthStorage | undefined = undefined;
