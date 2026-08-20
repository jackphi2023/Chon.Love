# Chon.Love Signup / Onboarding V2 — SU-03/SU-04 Profile Contract

## Purpose

SU-03 freezes the data/write contract and SU-04 implements the Step 3 Personal Info UI. The design is deliberately compatible with existing member data: stricter registration rules apply only to the staged new-signup path and never retroactively invalidate active profiles.

Production schema was inspected before this work. At that point there were 48 non-deleted profiles and 44 active profiles. Hosted production data/schema is not mutated directly by these integration sessions.

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

A second marital/hôn nhân field would duplicate semantics and create inconsistent public/edit/search behavior, so SU-04 explicitly removes that proposal before release. Because the SU-03 migration is still unreleased, the migration source itself is corrected rather than adding a create/drop cleanup migration.

## Username decision

Signup V2 removes username from the visible registration UX, but username remains a mature public-profile/backend invariant.

`save_my_signup_personal_info_v2` therefore:

- preserves an existing username unchanged;
- generates a valid internal username only when the profile has none;
- never asks the user to enter a username during Step 3;
- never stores a password or generated username in the temporary signup draft.

## Staged RPC

`public.save_my_signup_personal_info_v2(...)` is the atomic Step 3 write for new/incomplete profiles.

Safety rules:

1. Authentication is required.
2. Only `profile_status = incomplete` may use the RPC.
3. Active, pending-review, suspended, deactivated, deleted, and other mature profiles cannot be rewritten through this stricter registration contract.
4. Signup V2 display name is 10–50 characters; height is capped at 220 cm without tightening mature/global profile constraints.
5. DOB remains private.
6. The RPC calls the established `complete_my_onboarding(...)` authority so the adult declaration and current Terms / Community Standards versions remain auditable even though SU-04 removes the three redundant visible checkboxes.
7. Only Step 1 + Step 3 attributes are written.
8. Province, exact location, avatar, discovery/nearby flags and `profile_status = active` are not set by Step 3.

A failed validation occurs inside the same database transaction, so under-age or invalid submissions do not leave a partially written DOB/profile state.

## Existing-user compatibility

SU-03/SU-04 deliberately do not add a global display-name 10–50 constraint or tighten the global height range. They also do not force active users back through Personal Info.

An incomplete user who already completed the mature age/policy onboarding contract continues to the existing profile bridge rather than being forced to satisfy new registration-only requirements retroactively.

## Location contract reserved for SU-05

No second province or coordinate field is added. SU-05 must continue to reuse:

- `public.profiles.province_id` for selected public province/city;
- `private.user_locations` for consented exact coordinates.

## Release boundary

- Migration: `supabase/migrations/20260820095000_su_03_signup_personal_info_contract.sql`
- Database contract: `supabase/tests/su_03_signup_personal_info_contract.sql`
- Shared validation: `packages/validation/src/index.ts`
- Step 3 UI: `apps/mobile/app/(onboarding)/index.tsx`
- Canonical dropdown mapping: `apps/mobile/src/lib/signup-profile-contract.ts`
- Production Supabase has not been directly mutated by this implementation session.
- Keep PR #73 Draft; do not merge to `main` until the complete Signup / Onboarding V2 release gate is green.
