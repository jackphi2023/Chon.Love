import { isEnvironmentName, type EnvironmentName } from '@myfan/config';

export type PublicWebEnvironmentStatus = {
  appEnvironment: EnvironmentName | 'unconfigured';
  supabaseConfigured: boolean;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  siteUrl: string | null;
};

function normalizeWebUrl(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/$/u, '');
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const url = new URL(trimmed);
    const localDevelopment = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !localDevelopment) return null;
    return `${url.origin}${url.pathname === '/' ? '' : url.pathname.replace(/\/$/u, '')}`;
  } catch {
    return null;
  }
}

export function getPublicSiteUrl(): string | null {
  const value = normalizeWebUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (!value || value.startsWith('/')) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getPublicAppUrl(): string {
  return '/app';
}

export function getPublicWebEnvironmentStatus(): PublicWebEnvironmentStatus {
  const environmentValue = process.env.NEXT_PUBLIC_MYFAN_ENV;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return {
    appEnvironment: isEnvironmentName(environmentValue) ? environmentValue : 'unconfigured',
    supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    supabaseUrl,
    supabaseAnonKey,
    siteUrl: getPublicSiteUrl(),
  };
}
