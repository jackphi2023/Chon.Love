# Chon.Love Signup / Onboarding V2 — SU-03 Profile Contract

## Purpose

SU-03 freezes the data and validation contract that SU-04 will use for the Personal Info screen. This session is intentionally additive: it does not redesign the UI, activate profiles, move existing member data, or deploy a migration to the production Supabase project.

Production schema was inspected before this change. At that point there were 48 non-deleted profiles and 44 active profiles. The SU-03 migration does not backfill or rewrite those rows.

## Canonical field mapping

| Signup V2 field | Canonical storage | SU-03 rule |
| --- | --- | --- |
| Date of birth | `private.user_identity.date_of_birth` | Required for new signup; existing `complete_my_onboarding` remains the 18+ and policy authority. Never copied to `public.profiles`. |
| Display name | `public.profiles.display_name` | Required in Signup V2, trimmed, 10–50 characters. Legacy global profile constraints remain unchanged. |
| Self gender | `public.profiles.gender` | Signup V2 currently accepts `male` / `female`, matching Step 1. The broader legacy enum is not removed. |
| Interested in | `public.profiles.interested_in` | `male` / `female` / `everyone`, matching Step 1. |
| Height | `public.profiles.height_cm` | Optional, integer 120–220 cm in Signup V2. The existing legacy/global 120–230 constraint is not tightened. |
| Weight | `public.profiles.weight_kg` | Optional, integer; reuses the established 35–250 kg database boundary. |
| Education | `public.profiles.education_level` | Reuses existing canonical enum. |
| Relationship status | `public.profiles.relationship_status` | Reuses existing canonical enum. |
| Marital status | `public.profiles.marital_status` | **Only new profile field in SU-03.** Nullable enum; no legacy backfill. |
| Children | `public.profiles.children_status` | Reuses existing canonical enum. |
| Drinking | `public.profiles.drinking_status` | Reuses existing canonical enum. |
| Smoking | `public.profiles.smoking_status` | Reuses existing canonical enum. |

The existing canonical option vocabularies remain the source of truth for education, relationship, children, drinking, and smoking. SU-03 adds only the marital-status vocabulary:

- `prefer_not_to_say`
- `never_married`
- `married`
- `separated`
- `divorced`
- `widowed`

## Username decision

Signup V2 removes username from the visible registration UX, but username is still a mature public-profile/backend invariant used by existing routes and profile links.

`save_my_signup_personal_info_v2` therefore:

- preserves an existing username unchanged;
- generates a valid internal username only when the profile has none;
- never asks the user to enter a username in SU-04;
- does not store the generated value in the temporary signup draft.

This avoids a destructive username migration while removing an unnecessary field from the registration UX.

## Staged RPC

SU-03 adds `public.save_my_signup_personal_info_v2(...)` for the new registration path.

Safety rules:

1. Authentication is required.
2. Only `profile_status = incomplete` may use the RPC.
3. Active, pending-review, suspended, deactivated, deleted, and other existing profiles cannot be rewritten through this stricter signup contract.
4. The RPC validates Signup V2 display-name and physical-field limits without tightening global legacy constraints.
5. It calls the existing `complete_my_onboarding(...)` authority so DOB remains private and the current Terms / Community Standards versions remain recorded.
6. It writes only Step 1 + Step 3 profile attributes.
7. It does **not** set province, coordinates, avatar, discovery/nearby flags, or `profile_status = active`.

A failed validation occurs inside the same database transaction. Under-age or invalid-profile submissions therefore do not leave a partially written DOB/profile state.

## Existing-user compatibility

SU-03 deliberately does **not** add a global `display_name 10–50` constraint, does not tighten the existing height constraint, and does not make `marital_status` required. Those product rules apply only to the staged new-signup RPC and shared Signup V2 validation schema.

This distinction is important because already-active profiles may contain valid historical values that predate the new registration UX. Existing member records should not become invalid merely because registration rules were improved.

## Location contract reserved for the next location session

No second province or coordinate field is added.

The future location screen must continue to reuse:

- `public.profiles.province_id` for the selected public province/city;
- `private.user_locations` for consented exact coordinates.

The mature `set_my_location` RPC currently assumes an active profile, so the onboarding-safe location write must be handled in the dedicated location SU session rather than hidden inside SU-03.

## Later Signup V2 fields

The repository already has canonical storage for later screens, including `headline`, `bio`, `looking_for`, `lifestyle_tags`, profile media, and selfie verification. SU-03 does not change those length/count contracts yet because their UI and release rules belong to later SU sessions.

## Release boundary

- Migration: `supabase/migrations/20260820095000_su_03_signup_personal_info_contract.sql`
- Database contract test: `supabase/tests/su_03_signup_personal_info_contract.sql`
- Shared client validation: `packages/validation/src/index.ts`
- Production data/schema has **not** been mutated by this implementation session.
- Keep PR #73 draft; do not merge to `main` until the complete Signup / Onboarding V2 release gate is green.
