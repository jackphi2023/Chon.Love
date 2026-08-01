# MyFan RLS and Storage Matrix

**Updated:** 2026-07-31  
**Scope:** Phase B foundation plus Phase C Creator Activity privacy tiers.

## Whole-feed privacy matrix

| Creator setting | anonymous / stranger | accepted friend | active Fan | Creator owner |
|---|---:|---:|---:|---:|
| `public` | full approved Activity | full approved Activity | full approved Activity | all own moderation states |
| `friends` | denied | full approved Activity | full approved Activity | all own moderation states |
| `fans` | denied | denied unless also Fan | full approved Activity | all own moderation states |

An active Fan qualifies for `friends` because Fan is the higher relationship tier. A block in either direction denies Activity regardless of friendship or Fan status.

The same matrix applies to:

- text,
- image originals,
- external video/link data,
- Activity-derived album rows,
- signed Storage URLs.

## Creator Activity tables

| Object | anon | authenticated viewer | Creator owner | moderator / super_admin | service_role |
|---|---|---|---|---|---|
| `public.creator_profiles.activity_visibility` | no direct write | no direct write | update through owner RPC | protected Admin operations | full server access |
| `public.creator_posts` | no direct table access | no direct table access | RPC-only create/archive/delete/read-owner | protected moderation RPC | full server access |
| `public.creator_post_media` | no direct table access | no direct table access | attached only through Creator post RPC | protected moderation RPC | full server access |
| `private.creator_post_unlocks` | none | none | none | historical reconciliation only | full server access |
| `private.creator_post_unlock_events` | none | none | none | historical reconciliation only | full server access |
| `public.reports.target_creator_post_id` | none | insert through report RPC only | no report self | moderation aggregate | full server access |

The old per-post unlock tables are deprecated. `send_gift_and_unlock_creator_post` is not executable by `anon` or `authenticated`.

## RPC matrix

| RPC | anon | authenticated | Authorization inside function |
|---|---:|---:|---|
| `get_creator_activity_access` | yes | yes | approved active adult Creator; block state; friendship/Fan evaluation; no content return |
| `list_creator_activity` | yes | yes | whole-feed privacy predicate or Creator owner |
| `list_creator_activity_album` | yes | yes | same whole-feed privacy predicate; approved image posts only |
| `get_creator_post_media_access` | yes | yes | same whole-feed privacy predicate; approved post/media |
| `set_my_creator_activity_visibility` | no | yes | `auth.uid()`, active adult, approved Creator, allowlisted mode |
| `create_creator_activity_post` | no | yes | active adult approved Creator, own private media, allowlisted content shape |
| `prepare_creator_activity_preview` | no | yes | post owner and source-media owner only |
| `archive_creator_activity_post` | no | yes | Creator owner only |
| `delete_creator_activity_post` | no | yes | Creator owner only; soft delete |
| `report_creator_activity` | no | yes | adult reporter, visible target, no self-report, rate limit |
| `list_creator_activity_moderation_queue` | no | yes | moderator or super-admin |
| `moderate_creator_activity_post` | no | yes | moderator or super-admin; audit log |

All SECURITY DEFINER functions use fixed empty `search_path`. Viewer identity, Creator identity, friendship, Fan membership and visibility are derived server-side.

## Storage matrix

| Bucket/object | denied viewer | authorized viewer | owner | moderator / super_admin |
|---|---|---|---|---|
| `activity-previews` derived asset | none | only when whole-feed predicate passes | own post | protected moderation access |
| Activity original in `pending-media` / `profile-media` | none | approved media when whole-feed predicate passes | own post | protected moderation access |
| KYC/private documents | none | self/protected workflow only | self/protected workflow | authorized KYC/Admin operation only |

The server does not return preview or original paths as a substitute for gated Activity. Signed URLs expire after 30 seconds and Storage rechecks the same privacy predicate.

## Profile presentation

Activity privacy does not hide the authenticated profile presentation fields:

- name and username,
- age calculated server-side,
- active profile status,
- introduction and interests,
- province/city,
- approximate distance,
- online/offline and last-active state.

Date of birth and exact coordinates remain private. Distance is returned only when both users have the same non-null province and fresh consented locations.

## Content constraints

- Text is mandatory and limited to 3,000 characters.
- Text-only, text plus one image, or text plus one allowlisted video link.
- `creator_post_media.post_id` is the primary key and `media_id` is unique.
- Image and video cannot coexist in one post.
- Video provider allowlist is HTTPS YouTube, youtu.be and OF.TV.
- All posts begin `pending_review`; non-owners receive only approved content.
- Approved Activity images automatically form the Activity-derived album.
