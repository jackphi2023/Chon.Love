# Chon.Love Signup / Onboarding V2 — SU-00 Baseline

Status: integration baseline through SU-08.

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
- A province-only resume/retry preserves an already-consented unexpired private location instead of silently deleting it. A later profile-activation gate must enable nearby only when that consent/location is still valid.
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
- Resume logic sends users to the earliest missing staged screen: Location first, then Looking For, then Photos.

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
- The mature/global headline contract remains up to 120 characters. Production audit found an existing active headline over 50 characters, so the stricter 10–50 rule stays signup-only.
- The mature biography maximum is widened from 500 to 4000 so a valid Signup V2 biography remains fully editable later. No mature minimum is added: production audit found existing active short biographies below 50 characters and these remain valid.
- Profile Edit is aligned to the 4000-character biography maximum while retaining the mature blank/short-bio behavior.
- `save_my_signup_headline_bio_v2(...)` is authenticated and incomplete-profile-only. It requires adult/policy completion, canonical province, valid Looking For data and at least one usable uploaded profile photo.
- The staged Step 7 RPC writes only headline/bio and never activates profile, discovery or nearby.
- Resume logic now advances through the earliest missing stage: Location → Looking For → Photos → About → Selfie.
- The selfie Edge Function independently rejects a new verification submit when Step 7 profile copy is incomplete, so a client route cannot bypass the server-side activation gate.
- The existing 60% face-similarity threshold, maximum five reference photos and declared-gender consistency-only behavior remain unchanged.

## Visual contract

- Primary action: red with white text; hover/press stays red with subtle elevation.
- Secondary action: pink active, red hover/press, gray disabled.
- Selected tag: yellow/gold border/background.
- Inputs/dropdowns: consistent 48–50 px minimum height, 15 px content.
- Field labels: 15 px bold.
- Help/warning/success copy: approximately 11–12 px gray/red/green.
- Step title remains a 28–32 px display heading.

## Release acceptance through SU-08

- Integration branch remains isolated from `main`.
- Shared public chrome / SignupShell remain the single registration presentation foundation.
- Email/password + signup OTP contract remains intact.
- Personal Info, Location, Looking For and Headline/Bio DB contracts are staged, least-privilege and regression-tested without backfilling existing users.
- Exact GPS remains private; only province/city is public.
- Looking-for content uses the existing typed profile taxonomy rather than a duplicate schema.
- Signup, mature validation/server storage and Profile Edit share the 4000-character looking-for ceiling.
- Signup photo selection has one dedicated five-slot screen and no longer runs the old combined profile activation bridge.
- Supported profile-image files that fit the backend contract are not recompressed or downscaled by the client.
- Signup V2 headline/bio minimums remain staged-only; mature existing short bios and >50-character headlines are not invalidated.
- Mature biography storage, validation, server RPC and Profile Edit are aligned to a 4000-character maximum.
- New selfie submissions require completed Step 7 profile copy before the verification/activation path can proceed.
- Production user data/schema remains unchanged by this implementation session.
- `save_my_signup_location_v2`, `save_my_signup_looking_for_v2` and `save_my_signup_headline_bio_v2` stay on a temporary structural/runtime-validated client boundary until the final SU-11 generated-types checkpoint.
- Database, typecheck, unit/build and browser regression workflows must be green before the integration PR leaves Draft.