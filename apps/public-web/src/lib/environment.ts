import { isEnvironmentName, type EnvironmentName } from '@myfan/config';

export type PublicWebEnvironmentStatus = {
  appEnvironment: EnvironmentName | 'unconfigured';
  supabaseConfigured: boolean;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
};

export function getPublicWebEnvironmentStatus(): PublicWebEnvironmentStatus {
  const environmentValue = process.env.NEXT_PUBLIC_MYFAN_ENV;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return {
    appEnvironment: isEnvironmentName(environmentValue) ? environmentValue : 'unconfigured',
    supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    supabaseUrl,
    supabaseAnonKey,
  };
}
