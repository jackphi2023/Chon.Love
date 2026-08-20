# Chon.Love Signup / Onboarding V2 — SU-05 Location

## Product behavior

Step 4 follows the Seeking-style location flow while keeping Chon.Love's privacy boundary explicit:

- `Tỉnh / thành phố` is required and selected from the canonical 34 active Vietnam province/municipality rows.
- Current GPS location is optional because browser/device permission can be denied.
- The public profile stores only `profiles.province_id`.
- Exact coordinates are never added to `public.profiles`; when the member consents, they stay in `private.user_locations` and are used by the existing distance/nearby backend.
- The UI never prints raw latitude/longitude. It only confirms capture and approximate accuracy.
- If GPS is unavailable or denied, registration can continue with the selected province/city and `nearby_enabled = false` unless an already-consented unexpired private location exists from a previous Step 4 attempt.

## Signup-safe server contract

SU-05 adds `public.save_my_signup_location_v2(...)` in the repository migration.

The staged RPC:

1. requires authentication;
2. accepts only `profile_status = incomplete` and undeleted profiles;
3. requires the existing SU-04 adult/policy authority through `public.is_current_user_adult()`;
4. validates that `province_id` is an active top-level Vietnam province/municipality;
5. accepts either no exact-location payload or one complete location payload;
6. applies the mature coordinate, source, capture-age and configured accuracy limits;
7. stores consented GPS only in `private.user_locations` and records a private `location_events` set event;
8. updates only `province_id` and the nearby opt-in state on the public profile;
9. does not activate `profile_status` or `discovery_enabled`;
10. returns only province/nearby/save-state metadata, never coordinates.

The mature `set_my_location(...)` RPC is unchanged and continues to require an already-active adult member. This avoids weakening the production discovery/location contract merely to support registration.

## Resume and consent behavior

A province-only retry does not silently delete a location the member already consented to earlier. If that private location is still enabled and unexpired, the staged RPC preserves the nearby flag. Members can explicitly update/disable location later through the mature profile/settings controls.

Step 3 now routes successful new registrations to `/onboarding/location`. If a registration resumes after SU-04 and has no province yet, it also resumes at Location instead of skipping Step 4.

## Transitional bridge

Until SU-06/SU-07 replace the old combined profile/photo screen, Step 4 continues to `/onboarding/profile`. The bridge no longer invents a first-province default or hard-codes `nearby_enabled = true`; it preserves the province and nearby state established by SU-05.

## Generated client-type checkpoint

`save_my_signup_location_v2` is temporarily held on the same structural/runtime-validated client boundary used elsewhere while the Signup V2 integration branch is evolving. Database migration + pgTAP are authoritative, and the Database workflow removes this staged RPC before comparing generated client types. SU-11 must perform the final generated-types checkpoint and remove this temporary filter before production release.

## Release boundary

- Migration: `supabase/migrations/20260820112500_su_05_signup_location_contract.sql`
- Database contract: `supabase/tests/su_05_signup_location_contract.sql`
- UI: `apps/mobile/app/onboarding/location.tsx`
- GPS helper: `apps/mobile/src/lib/signup-location.ts`
- Production Supabase is not directly mutated in SU-05.
- PR #73 remains Draft; do not merge to `main` until the complete Signup / Onboarding V2 release gate is green.