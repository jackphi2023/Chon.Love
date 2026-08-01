import { isEnvironmentName, type EnvironmentName } from '@myfan/config';

export type PublicWebEnvironmentStatus = {
  appEnvironment: EnvironmentName | 'unconfigured';
  supabaseConfigured: boolean;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  siteUrl: string | null;
};

export function getPublicSiteUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const localDevelopment = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !localDevelopment) return null;
    return url.origin;
  } catch {
    return null;
  }
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
