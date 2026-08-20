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
  // Chon.Love member surfaces are available only after profile setup + selfie
  // verification. pending_review/incomplete users stay inside onboarding even
  // when they already hold an authenticated Supabase session.
  if (status.profile_status !== 'active') return '/(onboarding)';
  return '/(tabs)';
}

export function getReadableAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/beta_password_managed/iu.test(message)) {
    return 'Mật khẩu của tài khoản Beta thử nghiệm được quản lý cố định. Vui lòng dùng thông tin đăng nhập đã được cấp.';
  }
  if (/email_and_password_required/iu.test(message)) {
    return 'Vui lòng nhập đầy đủ email và mật khẩu.';
  }
  if (/email_required/iu.test(message)) {
    return 'Vui lòng nhập email.';
  }
  if (/invalid email|email address.*invalid|email.*format/iu.test(message)) {
    return 'Email chưa đúng định dạng.';
  }
  if (/invalid_otp_format|otp_required/iu.test(message)) {
    return 'Mã OTP gồm 6 chữ số.';
  }
  if (/otp_session_missing/iu.test(message)) {
    return 'Mã OTP chưa tạo được phiên đăng nhập. Vui lòng yêu cầu mã mới và thử lại.';
  }
  if (/invalid login credentials|invalid_credentials/iu.test(message)) {
    return 'Email hoặc mật khẩu không đúng.';
  }
  if (/user already registered|already been registered|email.*registered/iu.test(message)) {
    return 'Email này đã có tài khoản. Hãy chuyển sang Đăng nhập.';
  }
  if (/email not confirmed/iu.test(message)) {
    return 'Email chưa được xác nhận.';
  }
  if (/password_too_short|weak password|password should be at least/iu.test(message)) {
    return 'Mật khẩu cần ít nhất 8 ký tự và nên có chữ hoa, chữ thường, số và ký tự đặc biệt.';
  }
  if (/same password|new password should be different/iu.test(message)) {
    return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
  }
  if (/auth_callback_session_missing/iu.test(message)) {
    return 'Liên kết xác thực chưa tạo được phiên đăng nhập. Vui lòng mở lại liên kết mới nhất trong email hoặc quay lại đăng nhập.';
  }
  if (/expired|invalid.*token|otp.*expired|token.*invalid|invalid.*otp/iu.test(message)) {
    return 'Mã OTP đã hết hạn hoặc không còn hợp lệ. Vui lòng yêu cầu mã mới.';
  }
  if (/rate limit|too many requests|over_email_send_rate_limit/iu.test(message)) {
    return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
  }
  if (/network|fetch failed|failed to fetch/iu.test(message)) {
    return 'Không thể kết nối máy chủ. Hãy kiểm tra mạng và thử lại.';
  }
  if (/provider.*not enabled|unsupported provider/iu.test(message)) {
    return 'Đăng nhập Google chưa được bật trên Supabase.';
  }
  if (/redirect/iu.test(message)) {
    return 'Đường dẫn quay lại ứng dụng chưa được cho phép.';
  }
  if (/cancel|closed|dismiss/iu.test(message)) {
    return 'Bạn đã đóng cửa sổ đăng nhập Google.';
  }
  return 'Không thể hoàn tất xác thực. Vui lòng thử lại.';
}
