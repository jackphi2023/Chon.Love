import { isEnvironmentName, type EnvironmentName } from '@myfan/config';

export type MobileEnvironmentStatus = {
  appEnvironment: EnvironmentName | 'unconfigured';
  supabaseConfigured: boolean;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
};

export function getMobileEnvironmentStatus(): MobileEnvironmentStatus {
  const environmentValue = process.env.EXPO_PUBLIC_MYFAN_ENV;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return {
    appEnvironment: isEnvironmentName(environmentValue) ? environmentValue : 'unconfigured',
    supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    supabaseUrl,
    supabaseAnonKey,
  };
}
