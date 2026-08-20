# Chon.Love Signup / Onboarding V2 — SU-07 Photos

## Product behavior

Step 6 is now a dedicated responsive photo screen at `/onboarding/photos`.

- show exactly five photo slots;
- require at least one usable avatar/public profile photo;
- recommend three photos;
- allow selecting multiple images from the device up to the remaining slot count;
- the first new upload becomes `avatar` when the profile does not already have a usable avatar; subsequent uploads are `public`;
- local selections can be removed before upload;
- existing finalized `avatar` / `public` media in `pending_review` or `approved` state is reused rather than duplicated;
- the retired combined username/profile/photo bridge at `/onboarding/profile` is removed;
- Step 5 Looking For and onboarding resume now route to Photos; Selfie Back returns to Photos.

SU-08 will insert the dedicated Headline/Bio screen between Photos and Selfie. The integration PR remains Draft and is not production-releasable before that step and the later release gates are complete.

## Image quality contract

Profile-photo preparation was changed specifically to prevent soft/blurry uploads and unnecessary quality loss.

1. Supported JPEG, PNG and WebP images are read from the picker and kept **byte-for-byte unchanged** whenever they already satisfy the existing server limits (maximum 10 MB and 12,000 px per dimension).
2. The client does **not upscale** small images.
3. Only unsupported formats or images that exceed the server contract are re-rendered.
4. Re-rendering starts at a high-quality fallback of up to **4096 px on the longest edge and JPEG quality 0.96**.
5. If that result still exceeds 10 MB, the client steps down only as much as required: 3072 px / 0.94, then 2560 px / 0.92.
6. The Step 6 preview and existing-photo preview use the full prepared/signed image URL with `resizeMode="cover"`; no low-resolution thumbnail or blur transform is introduced by SU-07.
7. Existing Supabase storage upload limits, moderation state, signed-URL delivery and media ownership remain unchanged.

This means ordinary supported profile photos under 10 MB are no longer passed through the previous unconditional 2048 px / 0.92 JPEG conversion path.

## Safety and compatibility

- SU-07 does not add or mutate a database schema.
- Existing `prepare_media_upload` / `finalize_media_upload` remain the media authority and already allow adult profile-setup users.
- No existing media rows are rewritten, deleted or re-compressed.
- Existing active members are not routed back through signup.
- Selfie verification still compares against at most five `avatar` / `public` profile images and keeps the existing 60% similarity threshold.
- Profile activation/discovery is no longer performed by the retired profile/photo bridge.

## Test coverage

`apps/mobile/src/lib/signup-photo-contract.test.ts` verifies:

- five-slot maximum and three-photo recommendation;
- only usable avatar/public pending-review or approved media counts for signup;
- avatar/public assignment for new uploads;
- remaining-slot arithmetic.

CI additionally typechecks and builds the new Expo Router screen and the high-quality media-preparation path.
