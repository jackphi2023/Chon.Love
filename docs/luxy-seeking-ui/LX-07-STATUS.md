# LX-07 — Profile Schema Migration — Completion Status

Status: **Complete**

Implementation branch: `agent/luxy-seeking-ui-foundation`

Implementation-tested head: `430764e5d6e9f9ffa1d4983b18bc6c6e06c8f843`

Previous LX-06 completion head: `3052f8d15084343575915b1fac6913c9f27f6d03`

## Objective

Create the Seeking-derived Luxy.Love profile data contract needed by the upcoming Edit Profile, Search and Member Profile sessions without prematurely rebuilding those UIs in LX-07.

The acceptance boundary is broader than the initial Signup fields. LX-07 covers:

- public nickname/display identity already present
- headline
- dating interest
- height and weight
- relationship status and children status
- smoking and drinking lifestyle
- education and occupation
- About/Bio using the existing field
- Looking For
- preferred age range
- canonical lifestyle/relationship intent tags
- public language labels
- existing canonical Vietnam province field

## Privacy boundary

LX-07 deliberately keeps sensitive identity/location data out of `public.profiles`.

- Date of birth remains in `private.user_identity.date_of_birth`.
- Exact coordinates remain in `private.user_locations.location`.
- CCCD/legal identity, KYC and payout/bank data remain in their existing private/operational boundaries.
- `public.profiles` contains only member-visible/searchable profile attributes.
- Preferred age range is discovery preference data and is not the member's date of birth.

The database pgTAP contract asserts that no `date_of_birth`, latitude, longitude or exact-location column is introduced into `public.profiles`.

## Migration

Added:

- `supabase/migrations/20260811130000_lx_07_profile_schema.sql`

### New public enums

`dating_interest`

- `female`
- `male`
- `everyone`

`relationship_status`

- `single`
- `divorced`
- `widowed`
- `open`
- `complicated`
- `prefer_not_to_say`

`children_status`

- `no_children`
- `has_children`
- `prefer_not_to_say`

`smoking_status`

- `never`
- `socially`
- `regularly`
- `trying_to_quit`
- `prefer_not_to_say`

`drinking_status`

- `never`
- `socially`
- `regularly`
- `prefer_not_to_say`

`education_level`

- `high_school`
- `vocational`
- `college`
- `bachelors`
- `masters`
- `doctorate`
- `other`
- `prefer_not_to_say`

`profile_lifestyle_tag` contains 17 canonical Seeking-derived Luxy codes:

- `true_love`
- `luxury_lifestyle`
- `active_lifestyle`
- `flexible_schedule`
- `emotional_connection`
- `refined`
- `fine_dining`
- `friendship`
- `long_term`
- `marriage_minded`
- `monogamous`
- `romantic`
- `ready_to_travel`
- `travel_companion`
- `vacation`
- `entertainment_events`
- `platonic`

These are internal canonical codes; LX-08/LX-09 can localize their Vietnamese labels without changing storage semantics.

### New `public.profiles` columns

- `headline text null`
- `interested_in dating_interest not null default everyone`
- `height_cm smallint null`
- `weight_kg smallint null`
- `relationship_status relationship_status not null default prefer_not_to_say`
- `children_status children_status not null default prefer_not_to_say`
- `smoking_status smoking_status not null default prefer_not_to_say`
- `drinking_status drinking_status not null default prefer_not_to_say`
- `education_level education_level not null default prefer_not_to_say`
- `occupation text null`
- `looking_for text null`
- `age_preference_min smallint not null default 18`
- `age_preference_max smallint not null default 99`
- `lifestyle_tags profile_lifestyle_tag[] not null default {}`
- `languages text[] not null default {}`

Legacy accounts therefore migrate safely without requiring synthetic personal information: optional physical/text fields remain null; controlled-vocabulary fields default to neutral values; age preference defaults to the broad adult range 18–99.

### Constraints

- headline: max 120 characters
- height: 120–230 cm
- weight: 35–250 kg
- occupation: max 120 characters
- Looking For: max 1000 characters
- preferred age: 18–99 and min <= max
- lifestyle tags: max 12
- languages: max 8; RPC validates each label at 2–32 characters

### Search-support indexes

Added partial indexes for active/discoverable profiles:

- `(gender, interested_in, province_id)`
- `(height_cm, weight_kg)`
- `(relationship_status, children_status)`
- GIN on `lifestyle_tags`

These are foundations for LX-09 Search Backend V2; LX-07 does not change current search ranking/RPC behavior.

## Backwards-compatible RPC strategy

Existing `public.update_my_profile(...)` remains unchanged and callable by the current Edit Profile UI.

Added:

- `public.update_my_luxy_profile(...)`

The V2 RPC:

1. requires authentication;
2. validates all LX-07 values;
3. delegates the mature existing profile contract to `update_my_profile(...)`, preserving adult onboarding, canonical province enforcement, account-state validation, interest normalization and username cooldown;
4. persists the new Luxy profile fields;
5. returns the updated `public.profiles` row.

ACL:

- `authenticated`: execute
- `service_role`: execute
- `anon`: no execute
- public grant revoked

The old RPC remains a compatibility path and its writes preserve the new LX-07 fields.

## Shared TypeScript contracts

Updated:

- `packages/validation/src/index.ts`
- `packages/validation/src/index.test.ts`

Added typed validation for:

- headline
- dating interest
- physical fields
- relationship/children
- smoking/drinking
- education/occupation
- Looking For
- age preference
- 17 lifestyle tags
- languages
- complete `luxyProfileEditorSchema`
- core `luxyProfileSetupSchema`

Generated Supabase types were regenerated from the actual local database schema and synchronized exactly to:

- `packages/supabase/src/database.types.ts`

The Database workflow byte-compares the generated file to the checked-in contract and passes.

## Typed application client

Updated:

- `packages/supabase/src/profile-media.ts`
- `packages/supabase/src/profile-media.test.ts`

Added exported enum aliases, `UpdateMyLuxyProfileInput` and `updateMyLuxyProfile(...)`.

The helper maps the full editor payload to `update_my_luxy_profile` and intentionally omits blank/nullable optional RPC arguments, allowing PostgreSQL's null defaults to clear those optional profile values without unsafe type casts.

The current Edit Profile screen is intentionally not switched to this helper in LX-07. That UI migration belongs to LX-08.

## Database regression contract

Added:

- `supabase/tests/lx_07_profile_schema.sql`

The pgTAP suite contains 30 assertions covering:

- safe defaults for legacy/new profiles
- exact enum/tag taxonomies
- authenticated/anonymous RPC ACL
- public/private privacy boundary
- adult onboarding gate
- complete Luxy V2 persistence
- legacy RPC compatibility
- tag/language normalization
- invalid height/weight/age/tag/language rejection

The main Database workflow now executes this suite after BR-01 through BR-09 and before concurrency/lint/type-generation gates.

## Validation results

### Application CI

Run: `31497250678`

Head: `430764e5d6e9f9ffa1d4983b18bc6c6e06c8f843`

Passed:

- workspace/environment validation
- BR-01 through BR-10 source guards
- lint
- TypeScript
- unit tests, including LX-07 validation and typed RPC mapping tests
- web applications + Expo web builds

### Database

Run: `31497250632`

Head: `430764e5d6e9f9ffa1d4983b18bc6c6e06c8f843`

Passed:

- clean reset from the complete repository migration history
- BR-01 through BR-09 database contracts
- LX-07 30-assertion pgTAP contract
- concurrent gift test
- concurrent withdrawal test
- public/private schema lint
- Supabase public TypeScript type generation
- generated database contract artifact upload
- exact generated-vs-checked-in type comparison
- full application workspace validation

### Browser E2E

Run: `31497250617`

Head: `430764e5d6e9f9ffa1d4983b18bc6c6e06c8f843`

Passed:

- clean local Supabase reset with LX-07 migration
- isolated browser fixtures
- BR-06 mobile web suite
- LX-03/04 authenticated shell regressions
- LX-05 homepage regressions
- LX-06 Signup/Login regressions
- existing social/privacy lifecycle
- BR-09 accessibility and resilience
- evidence upload and cleanup

## Implementation diff boundary

Compared with LX-06 completion head `3052f8d15084343575915b1fac6913c9f27f6d03`, the final LX-07 implementation changes only:

- `.github/workflows/database.yml`
- `packages/supabase/src/database.types.ts`
- `packages/supabase/src/profile-media.ts`
- `packages/supabase/src/profile-media.test.ts`
- `packages/validation/src/index.ts`
- `packages/validation/src/index.test.ts`
- `supabase/migrations/20260811130000_lx_07_profile_schema.sql`
- `supabase/tests/lx_07_profile_schema.sql`

A temporary branch-only workflow was used to copy the exact CLI-generated type contract into the repository and was deleted immediately afterward. It is not present in the final LX-07 tree or diff boundary.

## Explicit non-changes

LX-07 does not change or activate:

- current Search V1 behavior or nearby ranking
- authenticated/public shell UI
- Signup/Login UI
- current Edit Profile UI
- Member Profile UI
- Favorites
- private-photo request/access behavior
- messaging entitlements
- membership/subscription engine
- gift economics or payout timing
- KYC/CCCD behavior
- bank/withdrawal behavior
- production deployment
- `main`

## Next session

**LX-08 — Clone Edit Profile Seeking**

LX-08 should consume the new typed Luxy profile contract, preserve the private DOB/exact-location boundaries, and reconstruct Seeking's Edit Profile hierarchy and interaction model with Vietnamese Luxy copy and data semantics.
