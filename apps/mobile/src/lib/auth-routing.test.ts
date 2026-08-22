import { describe, expect, it } from 'vitest';
import { getReadableAuthError, resolveAuthenticatedRoute } from './auth-routing';

describe('authentication routing', () => {
  it('sends a new account to mandatory onboarding', () => {
    expect(resolveAuthenticatedRoute(null)).toBe('/(onboarding)');
  });

  it('keeps an incomplete adult-policy record inside onboarding', () => {
    expect(
      resolveAuthenticatedRoute({
        age_verified: true,
        policies_accepted: false,
        account_status: 'active',
        profile_status: 'incomplete',
      }),
    ).toBe('/(onboarding)');
  });

  it('opens the concrete Connect screen only after age and policy checks are complete', () => {
    expect(
      resolveAuthenticatedRoute({
        age_verified: true,
        policies_accepted: true,
        account_status: 'active',
        profile_status: 'active',
      }),
    ).toBe('/(tabs)/connect');
  });

  it('maps invalid password credentials without exposing provider details', () => {
    expect(getReadableAuthError(new Error('Invalid login credentials'))).toBe(
      'Email hoặc mật khẩu không đúng.',
    );
  });

  it('keeps password validation for existing password accounts', () => {
    expect(getReadableAuthError(new Error('password_too_short'))).toBe(
      'Mật khẩu cần ít nhất 8 ký tự và nên có chữ hoa, chữ thường, số và ký tự đặc biệt.',
    );
  });

  it('maps missing signup email separately from password login', () => {
    expect(getReadableAuthError(new Error('email_required'))).toBe('Vui lòng nhập email.');
    expect(getReadableAuthError(new Error('email_and_password_required'))).toBe(
      'Vui lòng nhập đầy đủ email và mật khẩu.',
    );
  });

  it('maps malformed and expired OTPs to code-specific guidance', () => {
    expect(getReadableAuthError(new Error('invalid_otp_format'))).toBe('Mã OTP gồm 6 chữ số.');
    expect(getReadableAuthError(new Error('OTP expired'))).toBe(
      'Mã OTP đã hết hạn hoặc không còn hợp lệ. Vui lòng yêu cầu mã mới.',
    );
  });

  it('maps a missing OTP session without exposing provider internals', () => {
    expect(getReadableAuthError(new Error('otp_session_missing'))).toBe(
      'Mã OTP chưa tạo được phiên đăng nhập. Vui lòng yêu cầu mã mới và thử lại.',
    );
  });

  it('maps a legacy callback without a restored session to a useful message', () => {
    expect(getReadableAuthError(new Error('auth_callback_session_missing'))).toBe(
      'Liên kết xác thực chưa tạo được phiên đăng nhập. Vui lòng mở lại liên kết mới nhất trong email hoặc quay lại đăng nhập.',
    );
  });

  it('does not expose raw Google provider errors in the UI', () => {
    expect(getReadableAuthError(new Error('Unsupported provider'))).toBe(
      'Đăng nhập Google chưa được bật trên Supabase.',
    );
  });
});
