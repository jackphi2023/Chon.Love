# Phase C Supplemental Session 23 — Creator Activity privacy tiers

## Content scope

Creator Activity is available on native Expo, authenticated Expo Web, public mobile web and Admin moderation.

A post must contain text and may use exactly one of these shapes:

1. Text only.
2. Text plus exactly one image.
3. Text plus exactly one allowlisted video link.

Multiple images are rejected. An image and a video link cannot appear in the same post.

## Whole-feed privacy

Creator Activity no longer locks an individual image. One Creator-level setting controls the entire approved Activity surface:

| Setting | Who can view the whole Activity |
|---|---|
| `public` | Anonymous visitors and signed-in adults, unless blocked |
| `friends` | Accepted friends and active Fans |
| `fans` | Active Fans only |

The Creator always sees their own posts, including moderation states. A two-way block overrides friendship and Fan status.

The hierarchy is intentional: stranger → accepted friend → active Fan. An active Fan qualifies for content set to `friends` because Fan is the higher relationship tier.

The single server predicate is `private.can_view_creator_activity(creator_id, viewer_id)`. It protects:

- post text,
- attached image originals,
- external video/link data,
- the Activity-derived album,
- signed Storage URLs.

A denied response contains the privacy mode, gate reason and Fan progress required to render the appropriate CTA, but it returns zero post and image counts and no content rows or Storage paths.

## Fan gate and gifts

When the Creator selects `fans`, the viewer sees a gift picker and progress toward the existing Fan threshold.

The app calls the existing atomic `send_gift` engine. A gift:

1. debits the immutable heart ledger,
2. creates the 70% Creator reward position,
3. updates cumulative `fan_progress`,
4. creates or reactivates `fan_memberships` only when the configured threshold is reached.

The client does not invent Fan status or unlock a feed locally. After the transaction, it invalidates the Activity access query and the server evaluates active Fan membership again.

`google_play_billing` and `send_gift` remain disabled in the development frontend. The picker and gate are visible, but the app does not create a fake transaction, fake balance or fake Fan membership.

The previous `send_gift_and_unlock_creator_post` RPC is no longer executable by `anon` or `authenticated`. Historical per-post entitlement tables remain only for migration history and reconciliation.

## Activity-derived album

There is no second user-managed Activity album.

`list_creator_activity_album(username, limit, offset)` returns images from approved image posts only:

- approved Activity post,
- approved media asset,
- not archived or deleted,
- ordered by Activity publication date.

The album uses the same whole-feed privacy predicate. A viewer cannot see an album image while the corresponding Activity feed is gated.

Archiving or deleting a post removes its image from both the feed and the derived album.

## Profile presentation remains visible

For an authenticated adult who is not blocked by the profile owner, the profile viewer continues to return:

- name and username,
- calculated age,
- active profile status,
- introduction and interests,
- province/city,
- approximate distance when both users share the same non-null province and have fresh consented locations,
- online/offline state and last activity time.

Activity privacy does not hide these profile presentation fields. It gates only the Activity and derived album section.

Exact coordinates and date of birth remain private. Distance is rounded and omitted when location is disabled, stale, outside the province or the province is missing.

## Video allowlist

Only HTTPS URLs from YouTube, youtu.be and OF.TV are accepted.

- YouTube URLs are canonicalized to a video ID.
- OF.TV is an external-link card and is never embedded in a WebView.
- The server does not fetch arbitrary metadata, follow caller-controlled redirects or access arbitrary hosts.
- External URLs never receive access tokens, internal user IDs, email, purchase tokens or location data.

## Image security

Activity images use the existing private media upload contract with `visibility=private`.

The original remains in private Storage. The JWT-protected `creator-activity-preview` Edge Function still creates a separate 64×64 derived preview for moderation and operational fallback. A viewer does not receive this preview as a substitute for denied Activity content.

Signed URLs expire after 30 seconds. Storage policies independently verify:

- owner access,
- moderator/super-admin access,
- approved post and media,
- approved active Creator,
- adult account state,
- block state,
- whole-feed Activity privacy.

## Moderation

All posts begin `pending_review`. Text, external link and image must be reviewed before publication. An image post cannot be approved before its original media is approved and the server preview is ready.

Admin RPCs require an authenticated moderator or super-admin. Decisions write `private.admin_audit_logs` with before/after JSON and request ID.

Users can report a post, its image or its external link. Rate limiting prevents duplicate reports within 60 seconds.

## Main database objects

- `public.creator_profiles.activity_visibility`
- `public.creator_posts`
- `public.creator_post_media`
- `public.fan_progress`
- `public.fan_memberships`
- `public.friendships`
- `public.reports.target_creator_post_id`
- private bucket `activity-previews`

Deprecated but retained for history:

- `private.creator_post_unlocks`
- `private.creator_post_unlock_events`
- `public.gift_transactions.unlock_target_type`
- `public.gift_transactions.unlock_target_id`

## RPCs

- `get_creator_activity_access`
- `set_my_creator_activity_visibility`
- `create_creator_activity_post`
- `prepare_creator_activity_preview`
- `list_creator_activity`
- `list_creator_activity_album`
- `get_creator_post_media_access`
- `archive_creator_activity_post`
- `delete_creator_activity_post`
- `report_creator_activity`
- `list_creator_activity_moderation_queue`
- `moderate_creator_activity_post`

Anonymous access is limited to Activity access evaluation, approved feed/album reads and signed media delivery. Creator writes, gifts, reports and Admin operations require authentication, with authorization enforced by server functions.

## Frontend routes

### Expo native / Expo Web

- `/(tabs)/activity` — Creator privacy setting and own feed
- `/activity/create` — composer
- `/activity/[username]` — privacy-aware Creator feed
- `/profile/[username]` — profile presentation plus gated Activity and derived album

### Public web

- `/hoat-dong?u=username`

The public page is `noindex`. Public Activity is shown only for `public`; friend-only and Fan-only modes show a login gate and return no content or image paths.

### Admin

- `/activity-moderation`

Admin moderation no longer displays a per-post gift requirement because privacy is set at the Creator level.

## Automated tests

Shared unit tests cover:

- the three supported post shapes,
- mandatory text,
- image/video mutual exclusion,
- labels and descriptions for all privacy modes,
- Fan eligibility within friend-only mode,
- whole-feed and album wording,
- YouTube URL forms,
- OF.TV canonicalization,
- rejection of HTTP, arbitrary hosts, localhost and look-alike domains,
- official YouTube thumbnail host generation.

## Remaining beta QA

The development project currently contains no profiles, posts, friendships, Fan memberships or gifts. The following still require fixtures or physical devices:

- public/friend/Fan visibility with multiple accounts,
- friendship acceptance and immediate access refresh,
- Google Play-funded gifts and Fan threshold progression,
- refund/reversal impact on active Fan membership,
- two-way block behavior,
- real image upload and Edge preview generation,
- Activity-derived album ordering,
- same-province and outside-province distance display,
- Android and mobile-browser rendering,
- moderator account workflow,
- signed URL expiry timing.
