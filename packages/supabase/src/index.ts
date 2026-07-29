import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

const publicSupabaseEnvironmentSchema = z.object({
  url: z.url().refine((value) => value.startsWith('https://'), 'Supabase URL must use HTTPS.'),
  anonKey: z.string().min(20, 'Supabase anon/publishable key is missing.'),
});

export type PublicSupabaseEnvironment = z.infer<typeof publicSupabaseEnvironmentSchema>;

export function parsePublicSupabaseEnvironment(
  input: PublicSupabaseEnvironment,
): PublicSupabaseEnvironment {
  return publicSupabaseEnvironmentSchema.parse(input);
}

export function createPublicSupabaseClient(
  input: PublicSupabaseEnvironment,
): SupabaseClient<Database> {
  const environment = parsePublicSupabaseEnvironment(input);
  return createClient<Database>(environment.url, environment.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
}
