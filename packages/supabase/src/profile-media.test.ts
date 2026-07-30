import { describe, expect, it } from 'vitest';
import { isMediaHiddenByModeration, isMediaVisibleToOwner } from './profile-media';

describe('post-moderated profile media', () => {
  it('shows newly finalized media without a public review label', () => {
    expect(isMediaVisibleToOwner({ moderation_status: 'pending_review', deleted_at: null })).toBe(true);
  });

  it('keeps approved media visible', () => {
    expect(isMediaVisibleToOwner({ moderation_status: 'approved', deleted_at: null })).toBe(true);
  });

  it('hides rejected, quarantined and deleted media', () => {
    expect(isMediaHiddenByModeration({ moderation_status: 'rejected', deleted_at: null })).toBe(true);
    expect(isMediaHiddenByModeration({ moderation_status: 'quarantined', deleted_at: null })).toBe(true);
    expect(isMediaHiddenByModeration({ moderation_status: 'deleted', deleted_at: '2026-07-30T00:00:00Z' })).toBe(true);
  });
});
