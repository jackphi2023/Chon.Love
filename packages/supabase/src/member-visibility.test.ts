import { describe, expect, it } from 'vitest';
import { isMemberAwaitingListingApproval, type MemberVisibilityStatus } from './member-visibility';

function visibility(overrides: Partial<MemberVisibilityStatus> = {}): MemberVisibilityStatus {
  return {
    listing_status: 'pending',
    listing_submitted_at: null,
    listing_reviewed_at: null,
    is_paid_override: false,
    discovery_preference_enabled: true,
    effective_discoverable: false,
    ...overrides,
  };
}

describe('member visibility helpers', () => {
  it('identifies a Free member waiting for listing approval', () => {
    expect(isMemberAwaitingListingApproval(visibility())).toBe(true);
  });

  it('does not show pending approval state for an active paid override', () => {
    expect(isMemberAwaitingListingApproval(visibility({ is_paid_override: true, effective_discoverable: true }))).toBe(false);
  });

  it('does not treat approved or rejected states as waiting approval', () => {
    expect(isMemberAwaitingListingApproval(visibility({ listing_status: 'approved', effective_discoverable: true }))).toBe(false);
    expect(isMemberAwaitingListingApproval(visibility({ listing_status: 'rejected' }))).toBe(false);
    expect(isMemberAwaitingListingApproval(null)).toBe(false);
  });
});
