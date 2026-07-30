# Phase C — Session 15: Profiles and post-moderated media

## Scope

Session 15 implements the authenticated profile flow for Expo native and Expo Web:

- create and edit username, display name, bio, gender and province/city;
- add up to 12 interests;
- control Discovery and Nearby eligibility;
- select an avatar from the library or camera;
- upload public-album images;
- resize and compress selected images before upload;
- render profile media from private Storage through short-lived, RLS-authorized URLs;
- keep rejected, quarantined and deleted media out of user-facing profile queries.

The UI never displays email, date of birth, exact coordinates, KYC data or bank data.

## Confirmed moderation rule

MyFan uses post-moderation for profile media in this phase:

```text
select image
→ validate MIME, dimensions and size
→ resize/compress to JPEG
→ prepare owner-bound private Storage path
→ upload
→ finalize as pending_review
→ display immediately inside authorized MyFan surfaces
→ Admin can approve, reject, quarantine or delete later
```

`pending_review` is an internal database and Admin state. The user-facing app does not show an “under review” badge, banner or label. A successful upload is presented simply as an uploaded avatar or public image.

When Admin rejects, quarantines or deletes media:

- it is removed from album queries;
- an affected avatar is cleared from the profile;
- newly requested signed URLs are denied by the Storage RLS policy;
- the owner only receives a generic notice that media was hidden for Community Standards reasons.

## Privacy and Storage

Buckets remain private:

- `pending-media`
- `profile-media`
- `kyc-private`

No bucket is converted to public. Authenticated clients receive short-lived signed URLs only after Storage RLS confirms that `private.can_view_media_internal(media_id, auth.uid())` is true.

Because signed URLs are time limited rather than instantly revocable, the app uses a 45-second expiry. A URL created before a moderation action may remain usable until that short expiry, while all subsequent URL creation is denied.

## Database changes

Migration:

```text
20260730050703_phase_c_15_post_moderated_profile_media.sql
```

Changes:

- adds `profiles.interests text[]` with a maximum of 12 entries;
- extends `update_my_profile` with validated interests;
- activates a completed adult profile immediately, unless enforcement status blocks it;
- makes finalized avatar/public/Fan media immediately viewable when authorization rules pass;
- automatically links public and Fan uploads to the owner's default album;
- allows `set_my_avatar` for `pending_review` and `approved` media;
- updates album media query results with private Storage location fields;
- clears avatars on reject, quarantine or delete;
- adds authenticated Storage SELECT policy for authorized profile media.

The client still cannot:

- write profile tables directly;
- choose another user's Storage path;
- approve media;
- bypass album Fan membership;
- use a service-role key.

## Application modules

- `packages/validation`: profile and image metadata schemas.
- `packages/supabase`: shared profile/media query and upload client.
- `apps/mobile/src/lib/profile-media.ts`: image picker, camera permission, resize and compression adapter.
- `apps/mobile/app/(tabs)/profile.tsx`: profile, avatar and public album.
- `apps/mobile/app/profile/edit.tsx`: profile editor for native and Expo Web.

## Feature boundary

The Fan Album database contract remains permission-gated. The `fan_album` feature flag remains disabled in Phase C until the Fan viewer and eligibility experience is completed in the later profile-viewer/Fan sessions.

The public profile viewer for other users remains Session 17 scope. Session 15 delivers the owner's profile creation/editing and media foundation used by that viewer.
