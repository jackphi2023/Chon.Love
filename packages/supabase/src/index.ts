import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

const publicSupabaseEnvironmentSchema = z.object({
  url: z.url(),
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
  allowInsecureLocalhost?: boolean;
};

function isInsecureLocalSupabaseUrl(value: string): boolean {
  const url = new URL(value);
  return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
}

export function parsePublicSupabaseEnvironment(
  input: PublicSupabaseEnvironment,
  options: Pick<PublicSupabaseClientOptions, 'allowInsecureLocalhost'> = {},
): PublicSupabaseEnvironment {
  const environment = publicSupabaseEnvironmentSchema.parse(input);
  const usesHttps = environment.url.startsWith('https://');
  const allowsLocalHttp = options.allowInsecureLocalhost === true && isInsecureLocalSupabaseUrl(environment.url);
  if (!usesHttps && !allowsLocalHttp) {
    throw new Error('Supabase URL must use HTTPS unless local development explicitly allows localhost HTTP.');
  }
  return environment;
}

export function createPublicSupabaseClient(
  input: PublicSupabaseEnvironment,
  options: PublicSupabaseClientOptions = {},
): SupabaseClient<Database> {
  const environment = parsePublicSupabaseEnvironment(input, options);
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

export * from './activity';
export * from './chat';
export * from './discovery';
export * from './gifts';
export * from './homepage';
export * from './interests';
export * from './mailbox';
export * from './member-profile';
export * from './membership';
export * from './private-photo';
export * from './profile-media';
export * from './search';
export * from './social-safety';
export * from './vietqr';
export * from './vietqr-reconciliation';
export * from './kyc-withdrawal-operations';
export * from './runtime-observability';
export type { Database } from './database.types';
