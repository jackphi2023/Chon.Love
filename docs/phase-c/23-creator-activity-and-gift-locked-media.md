# Phase C Supplemental Session 23 — Creator Activity

## V1 scope

Creator Activity is available on native Expo, authenticated Expo Web, public mobile web and Admin moderation.

The explicit V1 content shapes are intentionally narrower than the original proposal:

1. Text only.
2. Text plus exactly one image.
3. Text plus exactly one allowlisted video link.

Text is required for every post. Multiple images are not allowed. An image and a video link cannot appear in the same post.

## UI

The feed follows the structural ideas of the supplied reference: Creator header, verification state, timestamp, body, one primary media/link area and lightweight footer actions. It does not copy the reference product styling or branding.

## Video allowlist

Only HTTPS URLs from YouTube, youtu.be and OF.TV are accepted.

- YouTube URLs are canonicalized server-side to a video ID.
- OF.TV is an external-link card and is never embedded in a WebView.
- The server does not fetch arbitrary metadata, follow redirects or access arbitrary hosts, so the V1 implementation has no generic SSRF fetch surface.
- External URLs never receive access tokens, internal user IDs, email, purchase tokens or location data.

## Image and preview security

Activity images use existing private media upload contracts with `visibility=private`.

The original image remains in a private bucket. A JWT-protected Edge Function uses ImageMagick WASM to generate a separate 64×64 blurred preview in the private `activity-previews` bucket. The locked feed response contains only the preview bucket/path; it never returns the original storage path before an active entitlement exists.

Signed URLs expire after 30 seconds. Storage policies independently verify:

- owner access,
- moderator/super-admin access,
- approved post and media,
- approved active Creator,
- adult-account state,
- two-way block state,
- public image mode or active per-post entitlement.

## Gift lock

A post with one image can be `public` or `gift_locked`. Gift-locked posts snapshot one active item from `public.gift_catalog` and its heart-unit price.

`send_gift_and_unlock_creator_post(post_id, idempotency_key)` reuses the existing atomic `send_gift` engine and performs the unlock in the same database transaction. It never accepts a client-provided Creator, gift or price.

The transaction checks post/media/Creator moderation, block state, active gift and price snapshot, then:

1. Locks the viewer/post pair.
2. Reuses an existing active entitlement without charging again.
3. Calls the existing immutable heart ledger and 70% Creator reward engine.
4. Tags the gift transaction with `unlock_target_type=creator_post` and the exact post ID.
5. Creates or reactivates one entitlement for the viewer/post pair.
6. Records an unlock audit event.

Gift reversal updates revoke the entitlement. Fully reversed transactions become `refunded`; partial reversal places access in `fraud_hold`. New signed URLs are denied immediately after revocation.

`send_gift` remains feature-flagged off in the current development frontend. The UI explains that real gifting waits for Google Play Billing; it never mutates balance or simulates success client-side.

## Moderation

All new posts start in `pending_review`. Text, external link and image must be reviewed before publication. An image post cannot be approved until the original media is approved and the server preview is ready.

Admin RPCs require an authenticated moderator/super-admin role. Decisions write `private.admin_audit_logs` with before/after JSON and request ID.

Users can report a post, its image or its external link. Rate limiting prevents duplicate reports within 60 seconds.

## Database objects

- `public.creator_posts`
- `public.creator_post_media`
- `private.creator_post_unlocks`
- `private.creator_post_unlock_events`
- `public.gift_transactions.unlock_target_type`
- `public.gift_transactions.unlock_target_id`
- `public.reports.target_creator_post_id`
- private bucket `activity-previews`

## RPCs

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

Only feed and media access RPCs are callable by `anon`. Creator write, gift, report and Admin RPCs require `authenticated`, with authorization enforced inside the functions.

## Edge Function

`creator-activity-preview` requires a valid JWT. It authorizes the post through `prepare_creator_activity_preview`, uses service role only inside the server runtime to read the original and write the derived preview, and does not return or log signed original URLs.

## Frontend routes

### Expo native / Expo Web

- `/(tabs)/activity`
- `/activity/create`
- `/activity/[username]`

### Public web

- `/u/[username]/hoat-dong`

The public route is noindex and never permits anonymous gift transactions.

### Admin

- `/`
- `/activity-moderation`

The browser uses only a public Supabase key. Database role checks protect moderation operations.

## Automated tests

Shared unit tests cover:

- the three allowed V1 shapes,
- mandatory text,
- image/video mutual exclusion,
- gift requirement rules,
- YouTube URL forms,
- OF.TV canonicalization,
- rejection of HTTP, arbitrary hosts, localhost and look-alike domains,
- official YouTube thumbnail host generation.

## Remaining beta QA

The development project currently contains no profiles or posts. The following require fixtures or physical devices:

- two-account gift unlock,
- Google Play-funded balance,
- refund/reversal entitlement revocation,
- block behavior across two accounts,
- real image upload and Edge preview generation,
- Android and mobile-browser rendering,
- moderator account workflow,
- signed URL expiry timing.
