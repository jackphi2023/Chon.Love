# Luxy.Love — Signup live-selfie verification gate

Status: implementation patch on top of completed LX-12. This is intentionally separated from LX-13.

## Product flow

```text
18+ + policies
→ profile information
→ upload at least one avatar/public profile image
→ live selfie camera
→ server face comparison against up to five uploaded profile images
→ > 60%: approve + activate
→ <= 60% / no reliable comparison / provider error: pending_review
→ admin approve or hide/deactivate
```

Pending copy is fixed to:

> Ảnh chụp và ảnh upload chưa hợp lệ, chúng tôi cần xác minh để xem xét kích hoạt tài khoản hoặc vô hiệu

## Access model

A pending user may still have a Supabase authentication session so the app can display verification status, but cannot enter the Luxy member area.

- Mobile route resolver requires `account_status=active` and `profile_status=active`.
- Authenticated tabs layout re-checks the resolver before rendering Search/Favorite/Profile.
- Existing Search/Favorite/social database RPCs remain protected by `private.is_active_adult()`, which requires an active profile.
- Database trigger prevents member-originated profile writes from promoting `incomplete/pending_review` to `active` unless a resolved/approved member-photo-verification moderation case exists.
- While verification is pending, `discovery_enabled=false` and `nearby_enabled=false`.
- Existing profiles that were already active before this migration are grandfathered.

## Camera

### Web / desktop / mobile web

Uses `navigator.mediaDevices.getUserMedia()` with a front-facing live preview. The selfie step does not expose a file/gallery picker. The captured frame is center-cropped to a 1080×1080 JPEG.

### Native mobile

Uses the existing Expo ImagePicker camera adapter with `launchCameraAsync()`. The selfie screen does not expose the photo library path.

This is a live camera capture requirement, not a challenge-response anti-spoof liveness implementation. Before a broad public launch, add a dedicated face-liveness/anti-spoof provider if replay/photo-of-photo resistance is required.

## Face comparison

Server Edge Function: `member-photo-verification`.

- Boundary threshold: 60.
- Compare selfie against up to five newest avatar/public images that are uploaded and in `pending_review` or `approved` media status.
- Use the maximum similarity result.
- Auto-approve only when a reliable result is **strictly above 60%**.
- A result of exactly `60.00%` remains `pending_review`.
- Fail closed to `pending_review` when the provider is unconfigured, comparison fails, image quality is insufficient, or maximum similarity is not above the threshold.
- Selfie is stored in private bucket `member-verification`.
- Admin review URLs are signed for 60 seconds.

## Gender handling

The system does **not** infer gender identity from facial appearance.

During signup verification it stores/checks the profile's self-declared gender snapshot so the declared value cannot be swapped between profile setup and selfie submission. The biometric comparison answers the identity question: whether the selfie and uploaded profile image appear to be the same person.

If future product policy requires additional gender consistency review, it should be handled as profile-data moderation rather than automated appearance-based gender classification.

## Moderation/admin

Member selfie attempts reuse the existing immutable moderation/audit infrastructure:

- rule code: `member_photo_verification`
- source: `automated_scan`
- pass: `resolved + approve`
- fail/uncertain: `queued`, priority `high`
- admin actions: `approve` or `hide`
- admin decisions append the existing private admin audit log

Admin page: `/member-verifications`.

## Server-only deployment configuration

The current provider adapter uses AWS Rekognition CompareFaces. Configure only as server/Edge Function secrets:

```text
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_SESSION_TOKEN   # optional
```

Never expose these values using `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*`.

If the provider secrets are absent, the system intentionally returns `pending_review`; it never auto-approves without a comparison provider.

## Migration files

- `20260812020500_luxy_signup_selfie_verification_gate.sql`
- `20260812020600_luxy_member_photo_verification_admin.sql`
- `20260812020700_lx09_search_v2_backward_compat_signature.sql`

The third migration restores the original LX-09 24-argument Search V2 signature as a no-default backward-compatible overload after LX-12 extended Search V2 with `view_state` and `favorite_scope`. Current calls with optional/named arguments still resolve to the LX-12 function.

## Generated database contract

`packages/supabase/src/database.types.ts` is synchronized from the exact Supabase CLI artifact generated after a clean reset of this branch. This keeps the two admin verification RPCs and the LX-09/LX-12 Search V2 overloads aligned with the database contract.

## Release rule

Do not deploy this patch until database CI, workspace typecheck/build, and browser E2E pass. Deploy migration + Edge Function + provider secrets as one coordinated release because the signup route gate depends on the server verification endpoint.
