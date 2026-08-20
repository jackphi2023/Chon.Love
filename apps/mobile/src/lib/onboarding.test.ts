import { describe, expect, it } from 'vitest';
import { parsePolicyVersions } from './onboarding';

describe('parsePolicyVersions', () => {
  it('reads the current Terms and Community Standards versions from public config rows', () => {
    expect(parsePolicyVersions([
      { key: 'terms_version_current', value_json: 'terms-v3' },
      { key: 'community_rules_version_current', value_json: 'community-v2' },
    ])).toEqual({ terms: 'terms-v3', communityRules: 'community-v2' });
  });

  it('does not accept missing or non-string policy versions', () => {
    expect(() => parsePolicyVersions([
      { key: 'terms_version_current', value_json: 'terms-v3' },
      { key: 'community_rules_version_current', value_json: null },
    ])).toThrow('Current policy versions are not configured.');
  });
});
