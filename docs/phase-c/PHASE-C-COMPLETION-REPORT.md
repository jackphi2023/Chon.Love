# MyFan Phase C Completion Report

**Updated:** 2026-07-31  
**Supplemental session:** 23 — Creator Activity and whole-feed privacy  
**Branch:** `feature/phase-c-session-23-creator-activity`

## Completion status

The Creator Activity implementation is complete for automated code, database-contract and build verification. Production acceptance remains conditional on the multi-account, Google Play and physical-device checks listed below because the development database contains no profiles, posts, friendships, Fan memberships or gift fixtures.

## Product scope

Supported posts:

1. required text only;
2. required text plus exactly one image;
3. required text plus exactly one valid HTTPS video link.

Multiple images are not supported. Image and video cannot be combined.

## Creator-level privacy

One Creator setting controls the complete approved Activity surface:

| Setting | Access |
|---|---|
| Công khai | anonymous visitors and signed-in adults |
| Bạn bè | accepted friends and active Fans |
| Chỉ Fan | active Fans only |

The Creator always sees their own moderation states. Blocks override all relationship levels.

The authorization applies to:

- text,
- images,
- video and external-link data,
- Activity-derived album rows,
- signed media delivery.

The previous per-post image gift lock is retired. Its RPC is no longer executable by app clients; historical entitlement tables remain only for migration history.

## Fan gate

Fan-only mode displays the shared 20-item gift catalog and current Fan progress. Gift submission reuses the existing atomic `send_gift` engine, funded heart lots, immutable ledger, 70% Creator reward and cumulative Fan threshold.

The server activates Fan membership only when the configured threshold is reached. The client then re-fetches Activity access; it cannot create membership or reveal content locally.

`send_gift=false` and `google_play_billing=false` remain active in development, so the UI does not create fake transactions, balances or Fan status.

## Activity-derived album

Approved images are read directly from approved Activity image posts. There is no separate upload or album permission model.

Archiving or deleting a post removes its image from both the feed and the album query. The same whole-feed privacy predicate protects both surfaces.

## Profile presentation

Activity privacy does not hide the authenticated profile presentation fields:

- name and username;
- server-calculated age;
- active status;
- introduction and interests;
- province/city;
- approximate distance;
- online/offline and last-active state.

DOB and exact coordinates remain private. Distance is omitted unless both users have a matching non-null province and fresh consented locations.

## Database and migrations

Activity migrations applied to development:

- `20260730093317_phase_c_23_creator_activity_schema.sql`
- `20260730093519_phase_c_23_creator_activity_api_security.sql`
- `20260730093724_phase_c_23_creator_activity_gift_moderation.sql`
- `20260730093810_phase_c_23_creator_activity_rpc_acl_hardening.sql`
- `20260730102833_phase_c_23_creator_activity_fk_indexes.sql`
- `20260731070324_phase_c_23_creator_activity_privacy_tiers.sql`
- `20260731073536_phase_c_23_profile_distance_province_hardening.sql`

New privacy contract:

- enum `public.creator_activity_visibility`;
- `creator_profiles.activity_visibility`;
- `private.can_view_creator_activity`;
- `get_creator_activity_access`;
- `set_my_creator_activity_visibility`;
- `list_creator_activity_album`.

All Activity tables keep RLS enabled. App roles have zero direct writes to Activity and historical entitlement tables.

## Media and Edge Function

Activity originals remain in private Storage. The active JWT-protected Edge Function `creator-activity-preview` creates a separate 64×64 derived preview for moderation and operational fallback.

A viewer denied by the whole-feed predicate receives neither preview nor original path. Signed URLs expire after 30 seconds and Storage policy independently rechecks access.

## External links

Allowed HTTPS providers:

- YouTube watch URLs;
- youtu.be;
- YouTube shorts/embed;
- OF.TV content paths.

YouTube is canonicalized to a video ID. OF.TV remains an external-link card and is not embedded in a WebView. The server does not fetch arbitrary hosts or follow caller-controlled redirects.

## Mobile and Expo Web

Routes:

- `/(tabs)/activity` — privacy setting and own feed;
- `/activity/create` — composer;
- `/activity/[username]` — privacy-aware feed;
- `/profile/[username]` — default profile fields plus gated Activity and derived album.

Delivered behavior:

- three privacy radio options;
- whole-feed gate before content query;
- friend CTA;
- Fan gift picker and threshold progress;
- derived album;
- report/share/archive/delete;
- keyset feed pagination;
- short-lived signed URLs.

## Public web

Route:

- `/hoat-dong?u=username`

The page is `noindex` and compatible with static export.

- Public mode returns approved feed and album.
- Friend and Fan modes return a login gate only.
- Denied anonymous viewers receive no content or media paths.
- Anonymous gift transactions are not permitted.

## Admin moderation

Route:

- `/activity-moderation`

Admin reviews text, external link, preview, protected original, media state and reports. Per-post gift requirement and unlock count were removed from the moderation presentation because privacy now belongs to the Creator profile.

## Feature flags

```text
creator_activity = true
creator_activity_links = true
creator_activity_privacy_tiers = true
creator_activity_gift_lock = false
creator_activity_public_web = true
send_gift = false
google_play_billing = false
```

## Automated verification

Unit tests cover:

- three supported post shapes;
- mandatory text;
- image/video mutual exclusion;
- all privacy labels;
- Fan eligibility within friend-only mode;
- whole-feed and album scope;
- video URL allowlist and canonicalization;
- unsafe URL rejection.

GitHub Actions code pipeline #449 passed:

- frozen lockfile install;
- workspace validation;
- environment validation;
- ESLint;
- TypeScript;
- unit tests;
- Admin build;
- public web static export;
- Expo Web export.

Supabase verification confirmed:

- privacy enum and Creator columns;
- migration ledger entries;
- least-privilege RPC ACLs;
- legacy per-post unlock RPC unavailable to app roles;
- public/friend/Fan predicate used by feed, album and media access;
- development fixture counts remain zero.

## Deploy state

- Supabase migrations: applied to development.
- Edge Function: ACTIVE.
- Netlify preview: not deployed.
- APK/AAB: not generated.
- PR: Draft and unmerged.

## Remaining beta QA

- public/friend/Fan access across multiple accounts;
- friendship acceptance and immediate access refresh;
- Google Play-funded gifting and Fan threshold progression;
- refund/reversal effects on Fan membership;
- two-way block behavior;
- real image upload and Edge transformation;
- derived album ordering and archive removal;
- same-province, missing-province and outside-province distance;
- Android 360–430 px and mobile browsers;
- moderator workflow;
- signed URL expiry;
- screen reader and dynamic font;
- Netlify preview.

This supplemental session must not be treated as production-ready until these fixture and device checks pass.
