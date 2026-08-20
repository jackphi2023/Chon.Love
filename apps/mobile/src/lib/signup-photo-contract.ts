export const SIGNUP_PROFILE_PHOTO_LIMIT = 5;
export const SIGNUP_RECOMMENDED_PHOTO_COUNT = 3;

export type SignupProfilePhotoLike = {
  visibility: string;
  moderation_status: string;
  deleted_at: string | null;
};

export function isUsableSignupProfilePhoto(media: SignupProfilePhotoLike): boolean {
  return (
    media.deleted_at === null &&
    (media.visibility === 'avatar' || media.visibility === 'public') &&
    (media.moderation_status === 'pending_review' || media.moderation_status === 'approved')
  );
}

export function remainingSignupPhotoSlots(existingCount: number, pendingCount: number): number {
  return Math.max(0, SIGNUP_PROFILE_PHOTO_LIMIT - Math.max(0, existingCount) - Math.max(0, pendingCount));
}

export function signupUploadVisibility(hasAvatar: boolean, uploadIndex: number): 'avatar' | 'public' {
  return !hasAvatar && uploadIndex === 0 ? 'avatar' : 'public';
}
