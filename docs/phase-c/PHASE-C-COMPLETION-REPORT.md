# MyFan Phase C Completion Report

**Updated:** 2026-07-30  
**Supplemental session:** 23 — Creator Activity and gift-locked single image  
**Branch:** `feature/phase-c-session-23-creator-activity`

## Completion status

The supplemental Creator Activity implementation is complete for automated code, database-contract and build verification. Production acceptance remains conditional on the beta/device checks listed below because the development database contains no user, post, media or gift fixtures.

## Product scope delivered

V1 supports exactly three post shapes:

1. required text only;
2. required text plus exactly one image;
3. required text plus exactly one valid HTTPS video link.

Multiple images are not supported. Image and video cannot be combined. The limitation is enforced by UI validation, RPC validation and database constraints.

The Activity feed uses the MyFan design system while following the supplied reference only at the structural level: Creator identity, verification mark, timestamp, text, one primary media/link surface and lightweight footer actions.

## Database and migrations

Applied forward migrations:

- `20260730093317_phase_c_23_creator_activity_schema.sql`
- `20260730093519_phase_c_23_creator_activity_api_security.sql`
- `20260730093724_phase_c_23_creator_activity_gift_moderation.sql`
- `20260730093810_phase_c_23_creator_activity_rpc_acl_hardening.sql`
- `20260730102833_phase_c_23_creator_activity_fk_indexes.sql`

Created or extended:

- `public.creator_posts`
- `public.creator_post_media`
- `private.creator_post_unlocks`
- `private.creator_post_unlock_events`
- `public.gift_transactions.unlock_target_type`
- `public.gift_transactions.unlock_target_id`
- `public.reports.target_creator_post_id`
- private Storage bucket `activity-previews`

All new tables have RLS enabled. `anon` and `authenticated` have zero direct write grants on post/media/entitlement tables.

## RPC and Edge Function

Implemented RPCs:

- `create_creator_activity_post`
- `prepare_creator_activity_preview`
- `list_creator_activity`
- `get_creator_post_media_access`
- `archive_creator_activity_post`
- `delete_creator_activity_post`
- `send_gift_and_unlock_creator_post`
- `report_creator_activity`
- `list_creator_activity_moderation_queue`
- `moderate_creator_activity_post`

Deployed Edge Function:

- `creator-activity-preview`
- JWT verification enabled
- status ACTIVE
- generates a separate 64×64 blurred preview using ImageMagick WASM
- does not return the original image or signed original URL

## Gift-locked image security

- Original image remains in private Storage.
- Locked feed output contains only the separate derived preview path.
- Original Storage authorization is rechecked server-side.
- Original signed URLs expire after 30 seconds.
- Authorization accounts for owner, moderator role, post/media/Creator approval, active-adult state, two-way blocks and active viewer/post entitlement.
- `send_gift_and_unlock_creator_post` derives Creator, gift and price server-side and reuses the existing atomic heart ledger and 70% Creator reward engine.
- One active entitlement exists per viewer/post.
- Idempotency and advisory locking prevent double charge.
- Full reversal revokes access as `refunded`; partial reversal revokes access as `fraud_hold`.

The frontend feature flag `send_gift` remains false until Google Play Billing is enabled. The UI does not simulate balance, payment or unlock success.

## External-link protection

Allowed providers:

- HTTPS YouTube watch URLs;
- HTTPS youtu.be URLs;
- HTTPS YouTube shorts/embed URLs;
- HTTPS OF.TV content paths.

YouTube is normalized to a canonical video ID. OF.TV is an external-link card with a warning interstitial and is not embedded in a WebView. V1 does not fetch arbitrary metadata or follow user-supplied redirects, avoiding a generic SSRF fetch surface.

## Mobile and authenticated Expo Web

Delivered routes:

- `/(tabs)/activity`
- `/activity/create`
- `/activity/[username]`

Delivered behavior:

- Creator-only composer;
- text/one-image/video modes;
- one-image optimization and private upload;
- gift selection from the shared 20-item catalog;
- moderation status for the owner;
- approved public feed for viewers;
- locked-image overlay;
- share/report/archive/delete actions;
- keyset pagination and short-lived signed URLs.

## Public web

Delivered route:

- `/hoat-dong?u=username`

The static-export-compatible page is noindex, displays approved text/link content, displays public originals or locked blurred previews according to server output, and never permits an anonymous gift transaction.

## Admin moderation

Delivered routes:

- `/` Admin login
- `/activity-moderation`

The Admin client uses only the public Supabase key. Moderator/super-admin role checks occur in protected RPCs. The queue includes text, external link, preview, protected original, gift requirement, media state, report count and active unlock count. Decisions write private Admin audit logs.

## Feature flags

```text
creator_activity = true
creator_activity_links = true
creator_activity_gift_lock = true
creator_activity_public_web = true
send_gift = false
google_play_billing = false
```

## Automated tests and CI

Shared unit tests cover:

- the three allowed post shapes;
- mandatory text;
- image/video mutual exclusion;
- gift-lock requirement validation;
- YouTube URL variants;
- OF.TV canonicalization;
- rejection of HTTP, arbitrary hosts, localhost, loopback and look-alike domains;
- official YouTube thumbnail generation.

GitHub Actions code pipeline passed:

- frozen lockfile install;
- workspace validation;
- environment validation;
- ESLint;
- TypeScript;
- unit tests;
- Admin build;
- public web static export;
- Expo Web export.

Supabase verification passed for:

- five migration-ledger entries;
- RLS on all four new tables;
- zero client table writes;
- least-privilege RPC ACLs;
- exactly one image constraint;
- unique post/viewer entitlement;
- private preview bucket and Storage policies;
- foreign-key covering indexes.

## Advisor results

Security Advisor reports informational no-policy notices for RPC-only RLS tables and project-wide warnings for intended client-callable SECURITY DEFINER gateways. The Activity gateways use fixed empty `search_path`, explicit identity/role checks and least-privilege grants. Only the public feed and media-access functions are callable by `anon`.

Performance Advisor reports no remaining unindexed foreign-key notices after the final index migration. Remaining notices are unused-index information caused by the empty development database.

## Deploy preview

- Supabase migrations: applied to development.
- Edge Function: deployed and ACTIVE.
- Netlify/public preview: not deployed.
- APK/AAB: not generated.
- PR: Draft, not merged.

## Remaining beta QA

The development project currently has zero profiles, Creator Activity posts, attached Activity media, unlock entitlements and gift transactions. The following remain unverified in real end-to-end conditions:

- Creator creation and approval fixture;
- actual Android/Expo Web image upload;
- actual Edge preview transformation of uploaded media;
- moderator approval of a real post;
- two-account viewing without friendship;
- funded gift unlock after Google Play verification;
- full/partial reversal entitlement revocation;
- two-way block behavior;
- signed-URL expiry timing;
- physical Android layout at 360–430 px;
- Safari/Chrome mobile web;
- screen reader and dynamic font;
- Netlify static preview.

The supplemental session must not be treated as production-ready until these fixture/device checks pass.
