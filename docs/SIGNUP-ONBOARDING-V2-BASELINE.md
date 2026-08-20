# Chon.Love Signup / Onboarding V2 — SU-00 Baseline

Status: integration baseline through SU-09.

## Source of truth

- Base branch: `main`
- Original SU-00 base commit: `ebab066f4c19efd6f2b9a0a659258d59a97ed3c8`
- Integration branch: `feature/signup-onboarding-v2`
- Production database project: `asnydvqsduonyidjyyzq`
- Hosted production data/schema is not directly mutated by these implementation sessions.

## Safety boundaries

- Do not merge this branch to `main` until the complete Signup / Onboarding V2 release gate is green.
- Do not reset, recreate, truncate or destructively backfill existing member tables.
- Do not change existing user IDs, usernames, public profile codes, media ownership, membership, balances or verification history.
- Signup-only staged contracts must not weaken mature active-member authorization/privacy behavior.
- Widening a mature content maximum is allowed only when it is backwards-compatible and needed so valid Signup V2 data remains editable later.
- Do not turn stricter new-signup rules into global constraints that can invalidate historical active profiles.

## SU-01 UI foundation

- Shared public Header/Footer extracted from Homepage.
- `SignupShell` + eight-step `ProfileSetupProgress`.
- Shared red/pink buttons, form labels/help text, inputs, tags and responsive dropdown primitive.
- Responsive desktop + mobile-web presentation.

## SU-02 authentication

- Email registration remains email + password, minimum 8 characters.
- Signup email confirmation uses a 6-digit OTP when confirmation is required.
- Google OAuth skips the email OTP screen.
- Password login remains available for existing and new email/password accounts.
- Step 1 gender/interest is preserved through auth redirects in an expiring session-scoped draft; the password is never stored there.

## SU-03/SU-04 personal-info contract

- Required Step 3 fields: date of birth and display name; Step 1 gender/interest remains required context.
- Optional: height, weight, education, relationship status, children, drinking, smoking.
- Every optional dropdown uses `Chọn` → `Không chia sẻ` → actual values.
- Physical not-shared state persists as `null`; enum not-shared state persists as canonical `prefer_not_to_say`.
- Public presentation continues to treat these mature values as **Chưa chia sẻ**, and the values remain editable in Profile Edit.
- `relationship_status` is the only relationship/marital-state field. **No `marital_status` type/column is introduced.**
- DOB remains in `private.user_identity` and reuses the established versioned 18+ / policy authority.
- The three old visible adult/Terms/Community checkboxes are removed from Step 3; acceptance remains recorded atomically when Personal Info is saved.
- Signup V2 display name is 10–50 and signup height is 120–220, enforced only by staged signup validation/RPC rather than by tightening mature global constraints.
- The staged Personal Info RPC is restricted to `profile_status = incomplete`, preserves existing usernames, generates an internal username only when missing, and does not activate discovery, location, media or the profile.
- Existing incomplete users who already completed the mature age/policy onboarding contract are not forced through stricter Personal Info again.

## SU-05 location contract

- Step 4 is a dedicated responsive `Vị trí của bạn` screen using the same SignupShell/progress/chrome.
- `Tỉnh / thành phố` is required and comes from the canonical 34 active Vietnam province/municipality rows; no arbitrary first-province default is invented.
- Current GPS is optional and explicitly consent-based so a denied browser/device permission cannot block registration.
- Public profile storage remains `profiles.province_id`; no public latitude/longitude/location columns are introduced.
- Consented exact location remains only in `private.user_locations`, with the existing configuration bounds for accuracy/capture age and private location-event auditing.
- The staged `save_my_signup_location_v2` accepts only incomplete profiles that already satisfy the SU-04 adult/policy authority and never activates the profile or discovery.
- Existing database integrity requires `nearby_enabled` to imply `discovery_enabled`; therefore both GPS and province-only Step 4 saves keep public `nearby_enabled = false` while the profile is incomplete.
- A province-only resume/retry preserves an already-consented unexpired private location instead of silently deleting it.
- The existing mature `set_my_location` contract remains unchanged for active adult members.

## SU-06 looking-for contract

- Step 5 is a dedicated responsive `Bạn đang tìm kiếm điều gì?` screen using the same SignupShell/progress/chrome.
- Relationship-intent text is required, trimmed and validated at 50–4000 characters with a live counter.
- Members must select 1–7 tags from the existing typed `profile_lifestyle_tag` vocabulary; no parallel free-text taxonomy is introduced.
- Selected tags use the shared yellow/gold state. When seven are selected, other tags are disabled until one is removed.
- Canonical storage remains `profiles.looking_for` and `profiles.lifestyle_tags`.
- The shared `looking_for` database/server maximum is widened from 1000 to 4000 as a backwards-compatible relaxation so valid Signup V2 content remains representable later. The existing Profile Edit multiline control is aligned to the same 4000-character maximum.
- The mature lifestyle-tag maximum remains 12; only Signup V2 requires 1–7.
- The staged `save_my_signup_looking_for_v2` accepts only incomplete profiles after SU-04 adult/policy completion and SU-05 canonical province selection.
- Step 5 writes only relationship-intent fields and never activates profile/discovery/nearby.

## SU-07 photo contract

- Step 6 is a dedicated responsive `Thêm ảnh của bạn` screen at `/onboarding/photos`.
- Exactly five photo slots are shown; at least one usable profile photo is required and three are recommended.
- Existing owner-visible avatar/public media in `pending_review` or `approved` state is reused rather than duplicated.
- The first new upload is assigned `avatar` when a usable avatar is not already available; additional images are `public`.
- Multi-select is capped to the remaining slot count and local selections can be removed before upload.
- The retired combined `/onboarding/profile` bridge is deleted, removing its old username/profile rewrite and premature profile/discovery activation path.
- Supported JPEG/PNG/WebP images that already fit the existing 10 MB / 12,000 px media contract are preserved byte-for-byte; small images are never upscaled.
- Unsupported or oversized files alone are re-rendered. The fallback starts at up to 4096 px on the longest edge with JPEG quality 0.96 and steps down only as needed to remain inside 10 MB.
- No low-resolution thumbnail or blur transform is added to Step 6 previews; local prepared images and existing signed media URLs are rendered directly.
- Existing media ownership, moderation, storage buckets and signed-URL delivery authority remain unchanged; SU-07 does not require a database migration.

## SU-08 headline + bio contract

- Step 7 is a dedicated responsive `Giới thiệu về bạn` screen at `/onboarding/about`, after Photos and before Selfie.
- `headline` is optional. Blank is valid; when provided it is trimmed and must contain 10–50 characters during Signup V2.
- `bio` is required during Signup V2 and is trimmed/validated at 50–4000 characters with a live counter.
- Canonical storage remains `public.profiles.headline` and `public.profiles.bio`; no duplicate onboarding-only profile-copy columns are introduced.
- The mature/global headline contract remains up to 120 characters. Production compatibility audit found an existing active headline over 50 characters, so the stricter 10–50 rule stays signup-only.
- The mature biography maximum is widened from 500 to 4000 so a valid Signup V2 biography remains fully editable later. No mature minimum is added: production compatibility audit found nine active profiles with nonblank biographies below 50 characters, and these remain valid.
- Profile Edit is aligned to the 4000-character biography maximum while retaining the mature blank/short-bio behavior.
- `save_my_signup_headline_bio_v2(...)` is authenticated and incomplete-profile-only. It requires adult/policy completion, canonical province, valid Looking For data and at least one usable uploaded profile photo.
- The staged Step 7 RPC writes only headline/bio and never activates profile, discovery or nearby.
- Resume logic advances through the earliest missing stage: Location → Looking For → Photos → About → Selfie.
- The selfie Edge Function independently rejects a new verification submit when Step 7 profile copy is incomplete, so a client route cannot bypass the server-side activation gate.

## SU-09 selfie verification + completion contract

- Step 8 keeps AWS Rekognition `CompareFaces` with a strict **greater than 60%** automatic-approval threshold and at most five avatar/public reference photos.
- The system does **not** infer gender from a face. It only checks that the submitted declared-gender snapshot has not changed during verification.
- A successful automatic comparison no longer jumps directly into the member UI. Step 8 renders an explicit `Xác minh thành công` state and the member chooses **Hoàn tất** before entering `Kết nối`.
- `Hoàn tất` routes to the canonical `/(tabs)` Kết nối member list. Desktop and mobile Kết nối already default to the `distance` sort, so members with usable private location rank near → far.
- `public.activate_verified_signup_profile_v2(uuid)` is the service-role-only final activation gate shared by automatic approval and trusted Admin approval. Ordinary authenticated/anonymous users cannot call it.
- The activation gate rechecks the staged adult/profile-copy/photo prerequisites, then atomically sets `profile_status = active` and `discovery_enabled = true`.
- `nearby_enabled` becomes true only when `private.user_locations` still contains explicit enabled consent, unexpired coordinates, acceptable accuracy and a capture time inside the same Search V2 freshness window. Province-only or stale GPS signups activate normally with nearby off.
- Exact coordinates never leave `private.user_locations`; Kết nối continues returning only rounded `distance_km` and never raw latitude/longitude.
- Trusted Admin `approve` now uses the same activation gate. Trusted Admin `hide` explicitly sets both discovery and nearby false while preserving the existing immutable Admin audit path.
- A below-threshold/manual-review state uses the required copy: **“Chúng tôi thấy ảnh chụp chưa giống trên 60% ảnh bạn upload, chúng tôi sẽ kiểm tra để xác nhận.”**
- Pending/manual-review and hidden states show **Về trang chủ**. The action clears the transient signup draft, signs the user out first, then navigates Home so the authenticated Homepage redirect cannot send an unapproved account back into protected member routes.
- Pending-review profiles remain undiscoverable and cannot browse member profiles until Admin approval.
- The transient signup draft is cleared only when the user explicitly completes an approved signup or leaves a pending/hidden flow to the public Homepage.

## Visual contract

- Primary action: red with white text; hover/press stays red with subtle elevation.
- Secondary action: pink active, red hover/press, gray disabled.
- Selected tag: yellow/gold border/background.
- Inputs/dropdowns: consistent 48–50 px minimum height, 15 px content.
- Field labels: 15 px bold.
- Help/warning/success copy: approximately 11–12 px gray/red/green.
- Step title remains a 28–32 px display heading.

## Release acceptance through SU-09

- Integration branch remains isolated from `main` and PR #73 remains Draft until the entire Signup V2 roadmap is accepted.
- Shared public chrome / SignupShell remain the single registration presentation foundation.
- Email/password + signup OTP contract remains intact.
- Personal Info, Location, Looking For and Headline/Bio DB contracts remain least-privilege and existing-user compatible.
- Exact GPS remains private; only province/city and rounded distance derivation are public-facing.
- Signup photo selection remains five-slot and preserves qualifying source image bytes without unnecessary recompression/downscaling.
- Signup-only display-name/height/headline/bio minimums do not invalidate mature historical profiles.
- Automatic and manual selfie approval now converge on one final server activation contract rather than two subtly different profile-update paths.
- Kết nối is the explicit post-success destination and its existing default sort is near → far when both members have valid nearby location consent.
- Manual review does not expose protected member browsing and has a deterministic public-Homepage exit.
- Production user data/schema remains unchanged by this integration implementation session.
- `activate_verified_signup_profile_v2` is service-role-only and removed from the generated consumer client contract; the three staged signup RPCs remain on their temporary structural/runtime-validated boundary until SU-11.
- Database, typecheck, unit/build, Browser E2E and LX-15 gates must be green before the integration PR leaves Draft.
