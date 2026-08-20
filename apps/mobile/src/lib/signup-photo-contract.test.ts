import { describe, expect, it } from 'vitest';
import {
  isUsableSignupProfilePhoto,
  remainingSignupPhotoSlots,
  SIGNUP_PROFILE_PHOTO_LIMIT,
  SIGNUP_RECOMMENDED_PHOTO_COUNT,
  signupUploadVisibility,
} from './signup-photo-contract';

describe('SU-07 signup photo contract', () => {
  it('keeps five visible slots and recommends three photos', () => {
    expect(SIGNUP_PROFILE_PHOTO_LIMIT).toBe(5);
    expect(SIGNUP_RECOMMENDED_PHOTO_COUNT).toBe(3);
    expect(remainingSignupPhotoSlots(1, 2)).toBe(2);
    expect(remainingSignupPhotoSlots(5, 1)).toBe(0);
  });

  it('counts only owner-visible avatar/public media that can be used for selfie comparison', () => {
    expect(isUsableSignupProfilePhoto({ visibility: 'avatar', moderation_status: 'pending_review', deleted_at: null })).toBe(true);
    expect(isUsableSignupProfilePhoto({ visibility: 'public', moderation_status: 'approved', deleted_at: null })).toBe(true);
    expect(isUsableSignupProfilePhoto({ visibility: 'private', moderation_status: 'approved', deleted_at: null })).toBe(false);
    expect(isUsableSignupProfilePhoto({ visibility: 'public', moderation_status: 'rejected', deleted_at: null })).toBe(false);
  });

  it('uses the first new upload as avatar only when the profile does not already have one', () => {
    expect(signupUploadVisibility(false, 0)).toBe('avatar');
    expect(signupUploadVisibility(false, 1)).toBe('public');
    expect(signupUploadVisibility(true, 0)).toBe('public');
  });
});
