import { describe, expect, it } from 'vitest';
import { resolveAuthenticatedRoute } from './auth-routing';

describe('signup completion routing', () => {
  it('routes an activated verified profile to the concrete Connect surface', () => {
    expect(resolveAuthenticatedRoute({
      age_verified: true,
      policies_accepted: true,
      account_status: 'active',
      profile_status: 'active',
    })).toBe('/(tabs)/connect');
  });

  it('does not expose Connect before profile activation finishes', () => {
    expect(resolveAuthenticatedRoute({
      age_verified: true,
      policies_accepted: true,
      account_status: 'active',
      profile_status: 'pending_review',
    })).toBe('/(onboarding)');
  });
});