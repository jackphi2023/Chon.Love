import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

export * from './account';
export * from './social';
export * from './media';
export * from './economy';
export * from './payout';
export type { CompositeTypes, Database, Enums, Json, Tables, TablesInsert, TablesUpdate } from './database.types';
export { Constants } from './database.types';

const schema = z.object({
  url: z.url().refine((value) => value.startsWith('https://'), 'Supabase URL must use HTTPS.'),
  anonKey: z.string().min(20, 'Supabase anon/publishable key is missing.'),
});

export type PublicSupabaseEnvironment = z.infer<typeof schema>;
export type CrossPlatformAuthStorage = {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
};
export type PublicSupabaseClientOptions = {
  storage?: CrossPlatformAuthStorage;
  detectSessionInUrl?: boolean;
};

export function parsePublicSupabaseEnvironment(input: PublicSupabaseEnvironment) {
  return schema.parse(input);
}

export function createPublicSupabaseClient(input: PublicSupabaseEnvironment, options: PublicSupabaseClientOptions = {}): SupabaseClient<Database> {
  const environment = parsePublicSupabaseEnvironment(input);
  return createClient<Database>(environment.url, environment.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: options.detectSessionInUrl ?? typeof window !== 'undefined',
      ...(options.storage ? { storage: options.storage } : {}),
    },
  });
}
