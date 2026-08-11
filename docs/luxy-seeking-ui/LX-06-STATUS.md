# LX-06 — Seeking-derived Signup/Login — Completion Status

Status: **Complete**

Implementation branch: `agent/luxy-seeking-ui-foundation`

Implementation browser-tested head: `ae38827190d67507c32f78adcd6789dbff4cc94e`

## Objective

Rebuild Luxy.Love public Signup/Login to follow the Seeking reference hierarchy and interaction model while preserving Luxy's existing Supabase Auth, onboarding age gate, security controls and product-specific copy.

LX-06 is an authentication and public-UX session. It does **not** introduce profile-schema persistence for new profile fields; that remains LX-07.

## Reference contract used

The implementation was cross-checked against:

- `Create Your Seeking Profile _ Sign Up Free Today!.htm`
- the user-provided Seeking signup screenshots
- the existing LX-00 visual-fidelity contract

Key Seeking-derived traits retained:

- dark navy public auth header
- product mark on the left and Login/Join action on the right
- white page with a narrow centered form rather than decorative dating cards
- short registration prompts and generous whitespace
- `I am...` / `Interested in...` style first-step choices
- simple text-only outlined controls
- restrained gray borders
- coral/red used for selection and the primary CTA
- full-width primary Continue/Create/Login action inside the form
- compact informational footer

No Seeking trademark, proprietary font, script or asset is copied.

## Delivered behavior

### 1. Stable public auth route

Added:

- `apps/mobile/app/auth/index.tsx`

Public URLs are now stable and independent from Expo Router group naming:

- `/auth` → Join / Signup
- `/auth?mode=login` → Login

The internal `(auth)` group remains an implementation detail.

### 2. Signup UX

Rebuilt `apps/mobile/app/(auth)/index.tsx`.

First step:

- `Đăng ký`
- `Tôi là...` → Nam / Nữ
- `Quan tâm đến...` → Nữ / Nam / Tất cả
- `Tiếp tục`

Second step:

- email
- password
- create account
- optional Google OAuth entry
- concise 18+ / legal handoff copy

The first-step gender and interest values are intentionally local UI state in LX-06. They are **not silently written into auth metadata or the current profile schema**. Persistence is deferred to LX-07 where the profile contract can be migrated explicitly.

### 3. Login UX

Login uses the same Seeking-derived public shell and keeps existing Luxy authentication behavior:

- email/password login
- forgot-password route
- optional Google OAuth entry
- readable authentication errors
- existing authenticated destination resolution

The auth screen remains effect-free so BR-06 keeps one authoritative post-login routing source.

### 4. Email signup auth contract

Updated `apps/mobile/src/lib/auth.ts`:

- added `signUpWithEmailPassword`
- normalizes email
- enforces minimum 10-character password contract
- supports Supabase email-confirmation mode
- if a session is immediately issued, resolves the existing onboarding/authenticated destination

Updated `apps/mobile/src/lib/auth-routing.ts` with readable Luxy error messages for signup/login failure cases.

### 5. Homepage integration

Updated `apps/mobile/app/index.tsx`:

- all Join CTAs route directly to `/auth`
- Login routes directly to `/auth?mode=login`

This removes an unnecessary intermediate click and keeps Signup/Login intent explicit.

## Visual decisions after screenshot review

The first draft was tightened after the user supplied additional Seeking screenshots.

Final LX-06 direction:

- white auth background
- form max width approximately 456 px
- no card border around the form
- 64 px desktop navy header / 60 px compact header
- full Luxy.Love wordmark in the auth header
- text-only radio-style choices, matching the static Seeking signup reference
- gray outline controls with red selected state
- primary red CTA across the form width
- minimal footer and subdued compliance copy

The 18+ requirement remains visible but intentionally secondary so it does not disturb the Seeking-derived visual hierarchy.

## Files changed in LX-06

Application/auth:

- `apps/mobile/app/(auth)/index.tsx`
- `apps/mobile/app/auth/index.tsx`
- `apps/mobile/app/index.tsx`
- `apps/mobile/src/lib/auth.ts`
- `apps/mobile/src/lib/auth-routing.ts`

Browser regression:

- `tests/br-06/luxy-auth.spec.mjs`
- `tests/br-06/luxy-desktop-shell.spec.mjs`
- `tests/br-06/luxy-public-homepage.spec.mjs`
- `tests/br-06/luxy-responsive-shell.spec.mjs`
- `tests/br-06/mobile-web-multi-account.spec.mjs`
- `tests/br-09/observability-accessibility-resilience.spec.mjs`

Documentation:

- `docs/luxy-seeking-ui/LX-06-STATUS.md`

## Validation

### Application CI

Run: `31487038443`

Head: `ae38827190d67507c32f78adcd6789dbff4cc94e`

Passed:

- workspace/environment validation
- BR-01 through BR-10 source guards
- lint
- TypeScript
- unit tests
- web applications + Expo web builds

### Browser E2E

Run: `31487038468`

Head: `ae38827190d67507c32f78adcd6789dbff4cc94e`

Passed browser execution:

- BR-06 mobile-web suite including LX-06 signup hierarchy
- LX-06 real email/password login at 390 px
- Homepage Login/Join → correct auth modes
- LX-03 desktop shell regression
- LX-04 responsive shell regression
- LX-05 homepage regressions
- existing multi-account social/privacy lifecycle
- BR-09 accessibility and resilience suite
- browser evidence upload

An earlier browser run exposed a duplicate-text locator in the Homepage → Login assertion. The runtime route and auth screen were already correct; the assertion was fixed by scoping to the semantic Login heading inside `luxy-auth-screen`, rather than weakening or changing the UI behavior.

## Explicit non-changes

LX-06 does not change:

- Supabase migrations
- database schema
- RLS policies
- RPC contracts
- location/search backend
- gift/fan economics
- private-photo access rules
- membership entitlements
- KYC/withdrawal behavior
- production deployment
- `main`

There are no `supabase/` changes in the LX-06 implementation diff.

## Next session

**LX-07 — Profile schema migration**

That session should explicitly define and persist the Seeking/Luxy profile fields required by Signup/Edit Profile instead of encoding new profile semantics inside auth metadata.