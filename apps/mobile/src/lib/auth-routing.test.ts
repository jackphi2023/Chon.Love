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

  it('opens the app only after age and policy checks are complete', () => {
    expect(
      resolveAuthenticatedRoute({
        age_verified: true,
        policies_accepted: true,
        account_status: 'active',
        profile_status: 'active',
      }),
    ).toBe('/(tabs)');
  });

  it('maps invalid password credentials without exposing provider details', () => {
    expect(getReadableAuthError(new Error('Invalid login credentials'))).toBe(
      'Email hoặc mật khẩu không đúng.',
    );
  });

  it('maps the product password rule to an eight-character minimum', () => {
    expect(getReadableAuthError(new Error('password_too_short'))).toBe(
      'Mật khẩu cần ít nhất 8 ký tự và nên có chữ hoa, chữ thường, số và ký tự đặc biệt.',
    );
  });

  it('maps a callback without a restored session to a useful message', () => {
    expect(getReadableAuthError(new Error('auth_callback_session_missing'))).toBe(
      'Liên kết xác thực chưa tạo được phiên đăng nhập. Vui lòng mở lại liên kết mới nhất trong email hoặc quay lại đăng nhập.',
    );
  });

  it('maps expired recovery links', () => {
    expect(getReadableAuthError(new Error('OTP expired'))).toBe(
      'Liên kết xác thực đã hết hạn hoặc không còn hợp lệ.',
    );
  });

  it('does not expose raw Google provider errors in the UI', () => {
    expect(getReadableAuthError(new Error('Unsupported provider'))).toBe(
      'Đăng nhập Google chưa được bật trên Supabase.',
    );
  });
});
