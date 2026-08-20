# Chon.Love Signup / Onboarding V2 — SU-06 Looking For

## Product behavior

Step 5 follows the Seeking-style long-form relationship-intent pattern while keeping the Chon.Love visual system and typed profile taxonomy:

- title: **Bạn đang tìm kiếm điều gì?**;
- one multiline relationship-intent field;
- trimmed content is required from **50 to 4000 characters**;
- live character counter uses the SignupShell helper/error styles;
- one to seven intent/lifestyle tags are required;
- selected tags use the shared Chon.Love yellow/gold selected state;
- once seven tags are selected, additional unselected tags are disabled until one is removed;
- the primary Continue action remains disabled until both text and tag rules are satisfied;
- desktop and mobile web share the same responsive SignupShell/Header/Footer foundation.

The tag list does not invent a second taxonomy. It reuses all existing `public.profile_lifestyle_tag` values already used by profile presentation/search: true love, long-term, marriage-minded, monogamous, emotional connection, romantic, friendship, platonic, luxury lifestyle, refined, active lifestyle, flexible schedule, travel-related intents, fine dining and entertainment/events.

## Storage and compatibility

The canonical fields remain:

- `public.profiles.looking_for`
- `public.profiles.lifestyle_tags`

SU-06 widens the shared `looking_for` storage constraint from 1000 to **4000** characters. This is a backwards-compatible relaxation: no historical value becomes invalid and no existing profile is rewritten.

The mature `update_my_luxy_profile(...)` server validation and the existing Profile Edit multiline control are both aligned to the same 4000-character maximum, so a member who enters a valid Signup V2 answer can later view, edit and re-save it without being forced back to the legacy 1000-character ceiling. Mature lifestyle tags remain compatible at up to 12; the stricter **1–7** rule applies only to new Signup V2 Step 5.

## Signup-safe server contract

SU-06 adds `public.save_my_signup_looking_for_v2(text, profile_lifestyle_tag[])`.

The staged RPC:

1. requires authentication;
2. accepts only undeleted `profile_status = incomplete` profiles;
3. requires the established SU-04 adult/policy authority;
4. requires a valid canonical Vietnam province/city already stored by SU-05;
5. trims and requires `looking_for` length 50–4000;
6. requires 1–7 typed lifestyle/intent selections;
7. de-duplicates repeated tags while preserving selection order;
8. writes only `looking_for`, `lifestyle_tags` and `updated_at`;
9. does not activate `profile_status`, `discovery_enabled` or `nearby_enabled`;
10. returns only length/count metadata and never exposes unrelated profile/private data.

Active legacy profiles are explicitly rejected by the staged RPC.

## Routing and resume

- Successful Step 4 Location now continues to `/onboarding/looking-for`.
- Step 5 Back returns to Location.
- Step 5 Continue currently moves to the transitional `/onboarding/profile` bridge; SU-07 will replace that bridge with the dedicated five-slot photo step.
- Resume logic sends an incomplete adult profile with no province to Location, and a profile with province but missing/invalid Step 5 data to Looking For.
- The transitional photo bridge also guards against bypassing Step 5.

## Validation and regression coverage

Shared validation adds a Signup V2-only schema for 50–4000 characters and 1–7 typed tags while widening the mature `profileLookingForSchema` maximum to 4000.

Database pgTAP verifies:

- authenticated vs anonymous execution;
- the widened 4000-character storage/server boundary;
- SU-04 and SU-05 prerequisites;
- valid long-form writes;
- exact 4000-character acceptance;
- 49/4001-character rejection;
- zero/eight-tag rejection;
- duplicate-tag normalization;
- no early profile/discovery activation;
- protection of active legacy profiles.

## Generated client-type checkpoint

`save_my_signup_looking_for_v2` joins `save_my_signup_location_v2` on the temporary structural/runtime-validated client boundary while this integration branch is evolving. The Database workflow filters both staged RPCs before comparing committed generated client types. **SU-11 must run the final generated-types checkpoint and remove this temporary filter before production release.**

## Release boundary

- Migration: `supabase/migrations/20260820113500_su_06_signup_looking_for_contract.sql`
- Database contract: `supabase/tests/su_06_signup_looking_for_contract.sql`
- Signup UI: `apps/mobile/app/onboarding/looking-for.tsx`
- Mature editor compatibility: `apps/mobile/app/profile/edit.tsx`
- Validation: `packages/validation/src/index.ts`
- Production Supabase is not directly mutated in SU-06.
- PR #73 remains Draft; do not merge to `main` until the complete Signup / Onboarding V2 release gate is green.