# Chon.Love Signup / Onboarding V2 — Profile Contract

## Purpose

SU-03 freezes the data/write contract, SU-04 implements Personal Info, and SU-08 extends the same compatibility principle to the public profile copy fields. Stricter registration rules apply only to the staged new-signup path and never retroactively invalidate active profiles.

Production schema/data has been inspected before each contract expansion. Hosted production data/schema is not mutated directly by these integration sessions.

## Canonical field mapping

| Signup V2 field | Canonical storage | Rule |
| --- | --- | --- |
| Date of birth | `private.user_identity.date_of_birth` | Required; existing `complete_my_onboarding` remains the 18+ and versioned-policy authority. Never copied to `public.profiles`. |
| Display name | `public.profiles.display_name` | Required in Signup V2, trimmed, 10–50 characters. Legacy global profile constraints remain unchanged. |
| Self gender | `public.profiles.gender` | Required by Step 1; Signup V2 currently accepts `male` / `female`. The broader mature enum is not removed. |
| Interested in | `public.profiles.interested_in` | Required by Step 1; `male` / `female` / `everyone`. |
| Height | `public.profiles.height_cm` | Optional. Dropdown: Chọn → Không chia sẻ → 120–220 cm. Chọn/Không chia sẻ persist as `null`. Mature/global 120–230 constraint is not tightened. |
| Weight | `public.profiles.weight_kg` | Optional. Dropdown: Chọn → Không chia sẻ → 35–250 kg. Chọn/Không chia sẻ persist as `null`. |
| Education | `public.profiles.education_level` | Optional. Chọn/Không chia sẻ normalize to `prefer_not_to_say`; actual choices reuse canonical enum. |
| Relationship status | `public.profiles.relationship_status` | Optional and **the only relationship/marital-state field**. No separate `marital_status` is created. |
| Children | `public.profiles.children_status` | Optional. Chọn/Không chia sẻ normalize to `prefer_not_to_say`. |
| Drinking | `public.profiles.drinking_status` | Optional. Chọn/Không chia sẻ normalize to `prefer_not_to_say`. |
| Smoking | `public.profiles.smoking_status` | Optional. Chọn/Không chia sẻ normalize to `prefer_not_to_say`. |
| Looking for | `public.profiles.looking_for` | Required in Signup V2, trimmed, 50–4000 characters. Mature maximum is widened to 4000 without adding a mature minimum. |
| Lifestyle tags | `public.profiles.lifestyle_tags` | Signup V2 requires 1–7 values from the existing enum; mature editor keeps its existing broader maximum. |
| Headline | `public.profiles.headline` | Optional in Signup V2. Blank is valid; when present it must be 10–50 characters. Mature/global headline remains up to 120. |
| Biography | `public.profiles.bio` | Required in Signup V2, trimmed, 50–4000 characters. Mature/global maximum is widened to 4000, but blank/short mature biographies remain valid. |

## Optional-field UX contract

All seven optional Step 3 dropdowns follow the same visible ordering:

1. `Chọn`
2. `Không chia sẻ`
3. actual values

`Chọn` means the member did not actively provide the fact during registration. `Không chia sẻ` means the member explicitly chose privacy. For compatibility with the mature profile schema, both end in the existing not-shared representation: `null` for height/weight and `prefer_not_to_say` for enum fields.

Public-profile presentation must continue to render these mature not-shared states as **Chưa chia sẻ**. The values remain editable later in Profile Edit. No new privacy column is introduced solely to distinguish the two registration UI states.

## Relationship-status decision

There is only one relationship-state attribute: `public.profiles.relationship_status`.

Signup V2 reuses the existing values:

- `single`
- `divorced`
- `widowed`
- `open`
- `complicated`
- `prefer_not_to_say`

A second marital/hôn nhân field would duplicate semantics and create inconsistent public/edit/search behavior, so the unreleased migration source is corrected directly rather than adding a create/drop cleanup migration.

## Username decision

Signup V2 removes username from the visible registration UX, but username remains a mature public-profile/backend invariant.

`save_my_signup_personal_info_v2` therefore:

- preserves an existing username unchanged;
- generates a valid internal username only when the profile has none;
- never asks the user to enter a username during Step 3;
- never stores a password or generated username in the temporary signup draft.

## Staged Personal Info RPC

`public.save_my_signup_personal_info_v2(...)` is the atomic Step 3 write for new/incomplete profiles.

Safety rules:

1. Authentication is required.
2. Only `profile_status = incomplete` may use the RPC.
3. Active, pending-review, suspended, deactivated, deleted, and other mature profiles cannot be rewritten through this stricter registration contract.
4. Signup V2 display name is 10–50 characters; height is capped at 220 cm without tightening mature/global profile constraints.
5. DOB remains private.
6. The RPC calls the established `complete_my_onboarding(...)` authority so the adult declaration and current Terms / Community Standards versions remain auditable even though the redundant visible checkboxes are removed.
7. Only Step 1 + Step 3 attributes are written.
8. Province, exact location, avatar, discovery/nearby flags and `profile_status = active` are not set by Step 3.

A failed validation occurs inside the same database transaction, so under-age or invalid submissions do not leave a partially written DOB/profile state.

## SU-08 profile-copy compatibility

Step 7 reuses the mature `headline` and `bio` columns instead of creating onboarding-only copies.

The signup-only contract is deliberately stricter:

- headline: blank or 10–50 characters;
- bio: 50–4000 characters.

Those rules are **not** converted into global minimum/maximum constraints that would invalidate mature users. Production audit before SU-08 found active profiles with short biographies below 50 characters and an active headline above 50 characters. Therefore:

- mature/global headline remains up to 120 characters;
- mature bio has no minimum;
- mature bio maximum is relaxed from 500 to 4000 so a Signup V2 biography remains fully editable after activation;
- Profile Edit is aligned to the 4000-character bio maximum.

`public.save_my_signup_headline_bio_v2(...)` is the staged Step 7 write. It requires an authenticated incomplete profile that has already completed adult/policy authority, Location, Looking For and at least one usable avatar/public profile photo. It writes only `headline`, `bio` and `updated_at`; it never activates the profile or discovery.

The selfie Edge Function performs an independent profile-copy completion check before accepting a new verification submit. This prevents a client-side route bypass from activating a profile without the Step 7 data contract.

## Existing-user compatibility

Signup V2 deliberately does not add global display-name minimums, tighten mature height, impose a global 50-character biography minimum, or globally cap headline at 50. It also does not force active users back through registration.

Existing incomplete users that already satisfy the mature age/policy contract resume at the earliest still-missing staged step rather than being forced through Personal Info again.

## Location and media privacy

No second province or coordinate field is added. Signup continues to reuse:

- `public.profiles.province_id` for selected public province/city;
- `private.user_locations` for consented exact coordinates;
- existing avatar/public media ownership and moderation tables for Step 6.

## Generated client-type boundary

During the integration branch, `save_my_signup_location_v2`, `save_my_signup_looking_for_v2` and `save_my_signup_headline_bio_v2` remain deliberately filtered from the committed generated client contract. The mobile layer calls these staged functions through narrow structural boundaries while Database pgTAP tests validate the authoritative server behavior. SU-11 must regenerate the final public database types and remove this temporary filter before production release. The Database workflow remains read-only (`contents: read`).

## Release boundary

- Personal Info migration: `supabase/migrations/20260820095000_su_03_signup_personal_info_contract.sql`
- Step 7 migration: `supabase/migrations/20260820124000_su_08_signup_headline_bio_contract.sql`
- Personal Info DB contract: `supabase/tests/su_03_signup_personal_info_contract.sql`
- Step 7 DB contract: `supabase/tests/su_08_signup_headline_bio_contract.sql`
- Shared validation: `packages/validation/src/index.ts`
- Personal Info UI: `apps/mobile/app/(onboarding)/index.tsx`
- Step 7 UI: `apps/mobile/app/onboarding/about.tsx`
- Canonical dropdown mapping: `apps/mobile/src/lib/signup-profile-contract.ts`
- Production Supabase has not been directly mutated by this implementation session.
- Keep PR #73 Draft; do not merge to `main` until the complete Signup / Onboarding V2 release gate is green.
