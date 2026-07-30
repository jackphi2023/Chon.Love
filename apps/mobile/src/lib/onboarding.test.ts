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
});
