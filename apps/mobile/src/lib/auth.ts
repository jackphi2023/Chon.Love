import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { getMobileSupabaseClient } from './supabase';
import { resolveAuthenticatedRoute, type AuthenticatedRoute } from './auth-routing';

export function getGoogleAuthRedirectUrl(): string {
  return Linking.createURL('auth/callback');
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

export async function completeGoogleAuthentication(code: string): Promise<void> {
  const client = requireAuthClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

export async function getAuthenticatedDestination(): Promise<AuthenticatedRoute> {
  const client = requireAuthClient();
  const { data, error } = await client.rpc('get_my_onboarding_status');
  if (error) throw error;
  return resolveAuthenticatedRoute(data?.[0] ?? null);
}

function requireAuthClient() {
  const client = getMobileSupabaseClient();
  if (!client) throw new Error('Supabase client is not configured.');
  return client;
}
