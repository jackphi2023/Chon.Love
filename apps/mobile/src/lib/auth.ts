import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { getMobileSupabaseClient } from './supabase';
import { resolveAuthenticatedRoute, type AuthenticatedRoute } from './auth-routing';

export type AuthSignOutScope = 'local' | 'global' | 'others';

const CONTROLLED_BETA_EMAIL = /^myfan(?:[1-9]|1[0-6])@gmail\.com$/iu;

export function getAuthCallbackUrl(next?: string): string {
  return next
    ? Linking.createURL('auth/callback', { queryParams: { next } })
    : Linking.createURL('auth/callback');
}

export function getGoogleAuthRedirectUrl(): string {
  return getAuthCallbackUrl();
}

export function isControlledBetaEmail(email: string): boolean {
  return CONTROLLED_BETA_EMAIL.test(email.trim().toLowerCase());
}

export async function startGoogleAuthentication(): Promise<void> {
  const client = requireAuthClient();
  const redirectTo = getGoogleAuthRedirectUrl();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
      scopes: 'openid email profile',
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  if (Platform.OS !== 'web') {
    if (!data.url) throw new Error('Google OAuth did not return an authorization URL.');
    await Linking.openURL(data.url);
  }
}

export async function signInWithEmailPassword(email: string, password: string): Promise<AuthenticatedRoute> {
  const client = requireAuthClient();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) throw new Error('email_and_password_required');
  const { error } = await client.auth.signInWithPassword({ email: normalizedEmail, password });
  if (error) throw error;
  return getAuthenticatedDestination();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const client = requireAuthClient();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error('email_required');
  if (isControlledBetaEmail(normalizedEmail)) throw new Error('beta_password_managed');
  const { error } = await client.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: getAuthCallbackUrl('/auth/reset-password'),
  });
  if (error) throw error;
}

export async function updateCurrentPassword(newPassword: string): Promise<void> {
  const client = requireAuthClient();
  if (newPassword.length < 10) throw new Error('password_too_short');
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw error;
  const { error: signOutError } = await client.auth.signOut({ scope: 'global' });
  if (signOutError) throw signOutError;
}

export async function signOutWithScope(scope: AuthSignOutScope): Promise<void> {
  const client = requireAuthClient();
  const { error } = await client.auth.signOut({ scope });
  if (error) throw error;
}

export async function completeAuthentication(code: string): Promise<void> {
  const client = requireAuthClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

export const completeGoogleAuthentication = completeAuthentication;

export async function getAuthenticatedDestination(): Promise<AuthenticatedRoute> {
  const client = requireAuthClient();
  const { data, error } = await client.rpc('get_my_onboarding_status');
  if (error) throw error;
  return resolveAuthenticatedRoute(data?.[0] ?? null);
}

export function getSafeAuthCallbackDestination(next: string | undefined): '/auth/reset-password' | null {
  return next === '/auth/reset-password' ? next : null;
}

function requireAuthClient() {
  const client = getMobileSupabaseClient();
  if (!client) throw new Error('Supabase client is not configured.');
  return client;
}
