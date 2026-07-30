import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

const publicSupabaseEnvironmentSchema = z.object({
  url: z.url().refine((value) => value.startsWith('https://'), 'Supabase URL must use HTTPS.'),
  anonKey: z
    .string()
    .min(20, 'Supabase anon/publishable key is missing.')
    .refine(
      (value) => !value.startsWith('sb_secret_') && !value.includes('service_role'),
      'Secret and service-role keys must never be used in a client bundle.',
    ),
});

export type PublicSupabaseEnvironment = z.infer<typeof publicSupabaseEnvironmentSchema>;

export type SupabaseAuthStorage = {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
};

export type PublicSupabaseClientOptions = {
  persistSession?: boolean;
  detectSessionInUrl?: boolean;
  flowType?: 'implicit' | 'pkce';
  storage?: SupabaseAuthStorage;
};

export function parsePublicSupabaseEnvironment(
  input: PublicSupabaseEnvironment,
): PublicSupabaseEnvironment {
  return publicSupabaseEnvironmentSchema.parse(input);
}

export function createPublicSupabaseClient(
  input: PublicSupabaseEnvironment,
  options: PublicSupabaseClientOptions = {},
): SupabaseClient<Database> {
  const environment = parsePublicSupabaseEnvironment(input);
  return createClient<Database>(environment.url, environment.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: options.persistSession ?? true,
      detectSessionInUrl: options.detectSessionInUrl ?? true,
      flowType: options.flowType ?? 'implicit',
      ...(options.storage ? { storage: options.storage } : {}),
    },
  });
}

export * from './chat';
export * from './discovery';
export * from './profile-media';
export * from './social-safety';
export type { Database } from './database.types';
