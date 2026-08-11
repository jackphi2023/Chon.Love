# LX-08 — Seeking-style Edit Profile + Profile Settings — Completion Status

Status: **Complete**

Implementation branch: `agent/luxy-seeking-ui-foundation`

Implementation-tested head: `c563ddb7761c06c642ec12ec0b3432ad7eb69e0b`

Previous LX-07 completion head: `c8e1c2e3a3f04ff25a5c558d81765161218f71fb`

## Objective

Rebuild the authenticated Luxy.Love Edit Profile experience around the supplied Seeking Edit Profile reference while connecting the screen to the LX-07 profile data contract, and ensure that profile-adjacent user controls are reachable from a coherent Settings hub.

The LX-08 completion boundary therefore covers both:

1. the Seeking-derived Edit Profile page; and
2. the Settings information architecture needed to cover profile privacy, identity verification preparation, membership, gifts and account safety without activating unfinished backend contracts.

## Edit Profile reconstruction

`apps/mobile/app/profile/edit.tsx` was rebuilt from the previous generic form into a Seeking-derived editor.

### Desktop

At desktop widths the page uses the reference hierarchy:

- authenticated Luxy shell at the top;
- `Xem hồ sơ` action at the upper right;
- persistent photo rail on the left;
- profile editor on the right;
- compact editable rows separated by subtle dividers;
- long editorial text areas for About and Looking For;
- membership/verification-style information lower in the page.

The photo rail supports:

- current primary photo;
- changing the primary photo;
- selecting multiple public profile photos;
- public-photo thumbnails / add placeholders.

### Tablet and phone

Below the desktop breakpoint the photo rail and profile editor stack vertically.

The existing LX-04 authenticated responsive shell remains intact; LX-08 does not reintroduce bottom tabs or horizontal nav scrolling.

The browser regression checks 1280 desktop, 768 tablet and 390 phone behavior, including no document horizontal overflow and >=44px phone actions.

## LX-07 profile contract integration

LX-08 now edits the full Luxy profile data contract using:

- `luxyProfileEditorSchema`
- `updateMyLuxyProfile(...)`
- `public.update_my_luxy_profile(...)` through the existing typed Supabase client

The editor covers:

- display name
- username bootstrap when one does not yet exist
- headline
- canonical Vietnam primary province
- height and weight
- relationship status
- children status
- smoking
- drinking
- education
- occupation
- About / bio
- Looking For
- interested-in gender
- preferred age range
- Luxy lifestyle/relationship tags
- interests
- languages
- discovery visibility
- nearby/location ranking opt-in
- member-since presentation

Secondary / other location controls are represented visually but deliberately remain locked rather than inventing persistence that does not exist in the current profile schema.

## Settings hub

`apps/mobile/app/settings/index.tsx` is now a real authenticated Settings hub rather than a placeholder.

The account dropdown in `LuxyShellNavigation` now includes `Cài đặt` and treats `/settings` as an account route.

Settings is grouped into:

### Hồ sơ & quyền riêng tư

- Edit Profile → `/profile/edit`
- Private photos → `/settings/private-photos`

### Xác thực

- Identity verification preparation → `/settings/verification`

### Gói dịch vụ

- Membership → `/settings/membership`

### Quà tặng & số dư

- Gift settings → `/settings/gifts`
- Balance → existing balance flow

### Tài khoản & an toàn

- existing account deletion flow

A reusable authenticated Settings layout was added at:

- `apps/mobile/src/components/luxy-settings-layout.tsx`

It preserves the Luxy authenticated shell and provides responsive section cards, link rows, notices and primary/secondary actions.

## Private-photo settings — functional now

Created:

- `apps/mobile/app/settings/private-photos.tsx`

The existing database/media contract already supports `media_visibility = private` and `prepare_media_upload(...)` allows authenticated owner uploads for that visibility. LX-08 exposes that existing capability through the typed application client.

`PreparedImageUpload.visibility` now includes `private`.

The page:

- lists the owner's existing private media;
- signs owner-only preview URLs through the existing private storage flow;
- allows selecting multiple images;
- uploads them with `visibility = private`;
- keeps them outside public/Fan albums;
- retains the existing moderation pipeline.

Gift state is not consulted when listing or uploading private images.

Granting another member access to private photos remains the separate LX-14 request/accept/decline session. LX-08 does not invent that permission state.

## Verification settings — camera/CCCD preparation without unsafe PII persistence

Created:

- `apps/mobile/app/settings/verification.tsx`

The page contains the intended profile-verification surface:

- direct selfie capture;
- CCCD front image selection;
- CCCD back image selection;
- LinkedIn verification placeholder;
- local previews and progress;
- explicit final-submit gate.

### Camera behavior

`apps/mobile/src/lib/profile-media.ts` now preserves the platform-specific camera flow:

- native Android/iOS requests camera permission before launch;
- web calls the camera picker directly from the user action so browser user activation is preserved.

The Expo permission copy in `apps/mobile/app.json` was also updated to Luxy.Love for photos, camera and location. Existing app slug/scheme/package identifiers were intentionally preserved to avoid changing build/deep-link identity during LX-08.

### Why selfie/CCCD are not uploaded server-side in LX-08

The repository already contains a KYC document upload contract, but that contract belongs to creator payout operations and requires creator eligibility. It is not a general member-profile identity verification contract.

LX-08 therefore does **not** send an ordinary member's selfie/CCCD into the payout KYC tables or claim the user is verified.

Instead:

- camera/library selection works;
- image processing/preview works locally;
- the final server submission remains disabled and explicitly marked for LX-20;
- local verification images are discarded when the page/session is left or reloaded.

LX-20 must introduce or approve the dedicated general-profile verification storage/status contract before PII persistence is activated.

## Membership settings — product contract without premature billing

Created:

- `apps/mobile/app/settings/membership.tsx`

The UI presents the target Luxy membership structure:

- Free
- Premium — 1,000,000 VND/month
- Diamond — 5,000,000 VND/month

Payment/upgrade actions remain disabled because membership entitlement and billing activation belong to LX-17/LX-18. LX-08 does not simulate a paid entitlement or charge a user before those contracts exist.

## Gift settings — coverage without fake preferences

Created:

- `apps/mobile/app/settings/gifts.tsx`

The page provides real navigation to existing:

- gift history;
- balance;
- web VietQR payment flow.

It also defines the intended UI contract for future persisted gift preferences:

- allow receiving gifts;
- gift notifications;
- gift-activity profile visibility.

Those toggles are intentionally non-persistent previews until LX-19 introduces the preference storage/policy contract.

The page explicitly keeps the product boundaries:

- Favorites are not gifts;
- private-photo permission is not a gift entitlement;
- gift ledger state does not infer profile/photo access;
- gifts do not create a promise to meet or communicate privately.

## Multi-photo helper

`apps/mobile/src/lib/profile-media.ts` now supports multi-select image preparation for public/private profile flows while retaining the existing image normalization and upload metadata validation.

## Browser regression coverage

Added:

- `tests/br-06/luxy-edit-profile.spec.mjs`
- `tests/br-06/luxy-settings.spec.mjs`

Coverage includes:

### Edit Profile

- desktop Seeking-derived two-column hierarchy;
- photo rail width/order;
- province picker;
- major LX-07 fields and sections;
- tablet/phone stacking;
- 390px save target >=44px;
- no horizontal overflow.

### Settings

- Settings reachable from account dropdown;
- Profile / Verification / Membership / Gifts / Account sections;
- verification camera and CCCD controls;
- disabled general-verification final submit;
- private-photo settings route;
- Premium/Diamond membership presentation;
- gift/profile privacy boundary;
- desktop and 390px mobile layouts;
- >=44px mobile controls;
- no horizontal overflow.

Evidence screenshots are uploaded by the BR-06 workflow.

## Validation results

### Application CI

Run: `31504068087`

Head: `c563ddb7761c06c642ec12ec0b3432ad7eb69e0b`

Passed:

- workspace/environment validation;
- BR-01 through BR-10 source guards;
- lint;
- TypeScript;
- unit tests;
- public/admin web builds;
- Expo web build.

### Browser E2E

Run: `31504068089`

Head: `c563ddb7761c06c642ec12ec0b3432ad7eb69e0b`

Passed:

- local Supabase start;
- clean reset from repository migrations;
- isolated browser fixtures;
- BR-06, including LX-08 Edit Profile and Settings regressions;
- BR-09 accessibility and resilience;
- browser evidence upload;
- cleanup.

## Implementation diff boundary

Compared with LX-07 completion head `c8e1c2e3a3f04ff25a5c558d81765161218f71fb`, LX-08 implementation changes only application/shared-client/test files:

- `apps/mobile/app.json`
- `apps/mobile/app/profile/edit.tsx`
- `apps/mobile/app/settings/index.tsx`
- `apps/mobile/app/settings/membership.tsx`
- `apps/mobile/app/settings/verification.tsx`
- `apps/mobile/app/settings/private-photos.tsx`
- `apps/mobile/app/settings/gifts.tsx`
- `apps/mobile/src/components/luxy-settings-layout.tsx`
- `apps/mobile/src/components/luxy-shell-navigation.tsx`
- `apps/mobile/src/lib/profile-media.ts`
- `packages/supabase/src/profile-media.ts`
- `tests/br-06/luxy-edit-profile.spec.mjs`
- `tests/br-06/luxy-settings.spec.mjs`

No `supabase/migrations/**`, database schema, RLS policy, RPC or Edge Function file changed in LX-08.

A temporary workflow used only to apply an exact TypeScript patch during implementation was deleted before the final implementation boundary and is not present in the final tree.

## Explicit non-changes / deferred sessions

LX-08 does not activate or complete:

- LX-09 Search Backend V2;
- LX-10 desktop Search clone;
- LX-11 mobile Search;
- LX-12 persisted Favorites;
- LX-13 member-profile clone;
- LX-14 private-photo request/accept/decline grants;
- LX-15 messaging entitlement;
- LX-17 membership engine;
- LX-18 payment/billing activation;
- LX-19 persisted gift preferences / final gift-policy migration;
- LX-20 server-side general member identity verification, verification status, or LinkedIn OAuth.

There is no merge to `main` and no production deployment in LX-08.
