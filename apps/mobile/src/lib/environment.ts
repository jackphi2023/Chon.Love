export type MobileEnvironmentStatus = {
  supabaseConfigured: boolean;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
};

export function getMobileEnvironmentStatus(): MobileEnvironmentStatus {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return {
    supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    supabaseUrl,
    supabaseAnonKey,
  };
}
