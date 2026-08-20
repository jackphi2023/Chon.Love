import { describe, expect, it } from 'vitest';
import { getReadableOnboardingError, parsePolicyVersions } from './onboarding';

describe('onboarding policy contract', () => {
  it('reads the current server policy versions', () => {
    expect(
      parsePolicyVersions([
        { key: 'terms_version_current', value_json: 'terms-2026-07-30-v1' },
        { key: 'community_rules_version_current', value_json: 'community-2026-07-30-v1' },
      ]),
    ).toEqual({
      terms: 'terms-2026-07-30-v1',
      communityRules: 'community-2026-07-30-v1',
    });
  });

  it('fails closed when policy configuration is incomplete', () => {
    expect(() => parsePolicyVersions([])).toThrow('Current policy versions are not configured.');
  });

  it('does not expose raw account-state errors', () => {
    expect(getReadableOnboardingError(new Error('account is not active'))).toBe(
      'Tài khoản hiện không hoạt động. Vui lòng liên hệ hỗ trợ.',
    );
  });

  it('maps staged Step 7 validation errors to member-facing copy', () => {
    expect(getReadableOnboardingError(new Error('signup headline must be blank or 10 to 50 characters'))).toBe(
      'Tiêu đề có thể để trống; nếu nhập cần từ 10 đến 50 ký tự.',
    );
    expect(getReadableOnboardingError(new Error('signup bio must be 50 to 4000 characters'))).toBe(
      'Hãy giới thiệu bản thân từ 50 đến 4000 ký tự.',
    );
  });
});
