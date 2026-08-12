# LOVE28 Production Fixtures Status

**Status:** COMPLETED — operational fixture cohort provisioned in hosted Supabase on 2026-08-13 (Asia/Ho_Chi_Minh).

This document records the production-data bootstrap only. It does **not** turn fixture users into product-schema migrations and does not commit the source ZIP, source HTML, user photos, passwords, seed tokens, or privileged bootstrap code to GitHub. This follows the repository's existing policy that beta/fixture accounts are operational test data provisioned separately from clean schema migrations.

## Cohort

28 fixture accounts exist from `love01@gmail.com` through `love28@gmail.com`. Their shared QA password was verified against all 28 Supabase Auth password hashes, but the password value is intentionally not stored in this repository.

Canonical public display names follow the supplied folder/file/image names when the HTML content contains a conflicting historical display name:

| Account | Display name |
|---|---|
| love01 | Yinniee |
| love02 | Ruby |
| love03 | Ann |
| love04 | Jenny |
| love05 | Jenifer |
| love06 | Luna |
| love07 | Rosy |
| love08 | Rani |
| love09 | Vivian |
| love10 | Lexyyyy |
| love11 | Jessie |
| love12 | Kristie |
| love13 | Charlene |
| love14 | Mai |
| love15 | Coco |
| love16 | Hien |
| love17 | Tsui |
| love18 | Scarlet |
| love19 | Jade |
| love20 | Angel |
| love21 | Thi |
| love22 | Naomi |
| love23 | Hana |
| love24 | Kim |
| love25 | Anyatr |
| love26 | Rachel |
| love27 | Molly |
| love28 | KT |

## Profile data

Each profile is active, discoverable and enabled for Nearby. Public profile fields were localized into Vietnamese from the supplied HTML and mapped into the LX-07/LX-09 typed profile contract: age, headline, About Me, Looking For, height, weight, relationship status, children, smoking, drinking, education, occupation, dating preference, age preference, languages and supported lifestyle tags.

Source gaps are preserved instead of invented. In particular, the supplied Jessie source is a Seeking search-result page rather than a full member-profile page, so unsupported detailed fields remain blank / `prefer_not_to_say` rather than being fabricated.

The public `member_since` source (`profiles.created_at`) was randomized within the requested 1–12 August 2028 window. The resulting cohort spans **2–12 August 2028**. Supabase Auth's real account-creation timestamps were not falsified into future dates.

## Photos

All source member photos were imported into the existing `profile-media` pipeline as approved operational fixture assets. There are **145 photos across 28 members**, matching the source counts for every member. For all 28 users, source photo #1 is the profile avatar and the remaining photos are public album photos.

The bootstrap copies are intentionally compressed low-resolution fixture copies of the supplied source images; original-resolution source media was not committed to the repository.

## Verification

All 28 fixture members are pre-approved for the two requested verification outcomes without submitting normal registration verification:

- Selfie/photo verification: approved through the existing member-photo verification moderation result.
- Identity/CCCD profile verification: approved in the LX-20 member verification state.

No CCCD legal name, document number, or document images were fabricated or inserted. KYC legal-name data remains empty for this cohort.

## Membership and normal interaction

All 28 fixture members have an active **Premium** fixture entitlement so they can exercise LX-15/LX-17 member-authored messaging immediately. This is required by the current server-side entitlement policy; Free members can receive/read but cannot start/send normal text. Diamond remains available through the normal upgrade flow.

Production smoke tests passed and test residue was removed:

- Favorite → unfavorite through `set_profile_favorite`.
- Direct conversation creation and text send through `get_luxy_profile_conversation` + `send_message`, without friendship.
- Public photo → private → public through `set_my_profile_photo_visibility`.
- Diamond membership order creation through the normal LX-17/LX-18 upgrade contract; smoke order removed after validation.
- LX-09 distance search returned a non-null positive `distance_km` for fixture locations.

## Location / distance

The 28 user-provided HCMC addresses are retained as fixture address metadata. Exact coordinates remain in `private.user_locations`; no exact coordinates are copied into `public.profiles`.

Four addresses were resolved directly by OpenStreetMap/Nominatim during the bootstrap (34 Lê Duẩn; 7 Công Trường Lam Sơn; 72 Lê Thánh Tôn; 37 Tôn Đức Thắng). The remaining addresses use explicitly marked `approximate_fixture` HCMC/district coordinates because the external geocoder rate-limited the one-time operation. Therefore, fixture distances are suitable for front-end Nearby/distance testing but must not be described as rooftop-accurate for all 28 addresses.

LX-09 intentionally requires a fresh consented location. A narrowly scoped cron job, `refresh-love28-fixture-locations`, refreshes only accounts tagged with the `love28-2026-08-12` fixture batch every 10 minutes. It does not relax the location freshness policy for normal users.

## Hosted Supabase release state

The hosted database was advanced from the previous BR release line to the Luxy schema/API stack required by these fixtures, through LX-20 dependencies (LX-07, LX-09, LX-12 through LX-20 as applicable). This includes the current profile, search, favorite, direct messaging, membership, billing, gifts, private-photo and verification contracts used by the front-end.

Temporary privileged bootstrap Edge Functions were disabled after provisioning; their active versions now require JWT and return HTTP 410 rather than exposing seed behavior. The temporary `pg_net` extension used only for the one-time bootstrap/geocoding transport was also removed after completion, restoring the pre-bootstrap extension state.

## Security follow-up

The broad Supabase table inventory emitted a critical **RLS-disabled** advisory for these private LX tables:

- `private.luxy_memberships`
- `private.luxy_upgrade_intents`
- `private.private_photo_access_requests`
- `private.luxy_membership_privacy`
- `private.luxy_membership_orders`
- `private.member_profile_verifications`
- `private.member_identity_documents`

This bootstrap did **not** auto-enable RLS because doing so without validating the intended private-schema SECURITY DEFINER/Admin access contract could break LX-13 through LX-20. A direct privilege audit found **no `anon` or `authenticated` table grants** on these seven private tables, and the current Supabase Security Advisor does not report an exposed-table RLS error for them. Even so, keep an explicit RLS/ACL review in the release checklist so the private-schema boundary remains intentional and regression-tested rather than relying on implicit assumptions.

The current Security Advisor does still report the existing project-level warning that leaked-password protection is disabled in Auth; this fixture bootstrap did not change that setting.

## Release boundary

- Operational data was updated in hosted Supabase as requested.
- No source user ZIP/photos/password/secrets were committed.
- No `main` merge is performed by this status update.
