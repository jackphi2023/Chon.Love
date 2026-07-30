export type AuthenticatedRoute = '/(onboarding)' | '/(tabs)';

export type AuthOnboardingStatus = {
  age_verified: boolean;
  policies_accepted: boolean;
  account_status: string;
  profile_status: string;
};

export function resolveAuthenticatedRoute(
  status: AuthOnboardingStatus | null | undefined,
): AuthenticatedRoute {
  if (!status) return '/(onboarding)';
  if (!status.age_verified || !status.policies_accepted) return '/(onboarding)';
  if (status.account_status !== 'active') return '/(onboarding)';
  return '/(tabs)';
}

export function getReadableAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/provider.*not enabled|unsupported provider/iu.test(message)) {
    return 'Đăng nhập Google chưa được bật trên Supabase.';
  }
  if (/redirect/iu.test(message)) {
    return 'Đường dẫn quay lại ứng dụng chưa được cho phép.';
  }
  if (/cancel|closed|dismiss/iu.test(message)) {
    return 'Bạn đã đóng cửa sổ đăng nhập Google.';
  }
  return 'Không thể đăng nhập bằng Google. Vui lòng thử lại.';
}
