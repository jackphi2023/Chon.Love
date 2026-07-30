import { describe, expect, it } from 'vitest';
import { getReadableAuthError, resolveAuthenticatedRoute } from './auth-routing';

describe('Google authentication routing', () => {
  it('sends a new Google account to mandatory onboarding', () => {
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

  it('does not expose raw provider errors in the UI', () => {
    expect(getReadableAuthError(new Error('Unsupported provider'))).toBe(
      'Đăng nhập Google chưa được bật trên Supabase.',
    );
  });
});
