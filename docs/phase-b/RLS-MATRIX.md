# MyFan RLS and Storage Matrix

**Updated:** 2026-07-30  
**Scope:** Phase B foundation plus Phase C supplemental Creator Activity.

## Creator Activity tables

| Object | anon | authenticated viewer | Creator owner | moderator / super_admin | service_role |
|---|---|---|---|---|---|
| `public.creator_posts` | no direct table access | no direct table access | RPC-only create/archive/delete/read-owner | protected moderation RPC | full server access |
| `public.creator_post_media` | no direct table access | no direct table access | attached only through Creator post RPC | protected moderation RPC | full server access |
| `private.creator_post_unlocks` | none | cannot select/insert/update/delete | cannot enumerate viewer identities | server/Admin aggregate only | full server access |
| `private.creator_post_unlock_events` | none | none | none | audit through protected operations | full server access |
| `public.gift_transactions` unlock target columns | no write | no direct write | no direct write | reversal uses existing protected engine | server writes only |
| `public.reports.target_creator_post_id` | none | insert through report RPC only | no report self | moderation queue aggregate | full server access |

All four new post/entitlement tables have RLS enabled. Direct `INSERT`, `UPDATE` and `DELETE` grants for `anon` and `authenticated` are absent.

## Creator Activity RPC matrix

| RPC | anon | authenticated | Authorization inside function |
|---|---:|---:|---|
| `list_creator_activity` | yes | yes | public approved post or owner; approved Creator; adult state; two-way block filter |
| `get_creator_post_media_access` | yes | yes | owner, approved public image, or active viewer/post entitlement |
| `create_creator_activity_post` | no | yes | `auth.uid()`, active adult, approved Creator, own private media, allowlisted content shape |
| `prepare_creator_activity_preview` | no | yes | post owner and source-media owner only |
| `archive_creator_activity_post` | no | yes | Creator owner only |
| `delete_creator_activity_post` | no | yes | Creator owner only; soft delete |
| `send_gift_and_unlock_creator_post` | no | yes | adult viewer, approved post/media/Creator, block-safe, server-derived gift and price |
| `report_creator_activity` | no | yes | adult reporter, visible target, no self-report, rate limit |
| `list_creator_activity_moderation_queue` | no | yes | moderator or super_admin role |
| `moderate_creator_activity_post` | no | yes | moderator or super_admin role; audit log required |

All SECURITY DEFINER functions use fixed empty `search_path`. Creator, viewer, price, gift and entitlement status are derived server-side rather than accepted as trusted client authorization fields.

## Storage matrix

| Bucket/object | anon | authenticated viewer | owner | moderator / super_admin |
|---|---|---|---|---|
| `activity-previews` derived preview | approved public post only | approved post and block-safe | own post | protected moderation access |
| Activity original in `pending-media` / `profile-media` | approved public image only | public image or active entitlement; block-safe | own post | protected moderation access |
| KYC/private documents | none | self/protected workflow only | self/protected workflow | authorized KYC/Admin operation only |

The locked feed response does not contain the original bucket/path until authorization succeeds. The preview is a separate 64×64 server-generated blurred asset, not CSS applied to the original. Signed URLs for Activity media expire after 30 seconds.

## Gift entitlement matrix

- Unique key: `post_id + viewer_id`.
- Client cannot create or modify entitlement rows.
- Existing active entitlement returns without a second charge.
- Unlock transaction references the exact post through `unlock_target_type=creator_post` and `unlock_target_id`.
- Full gift reversal sets entitlement to `refunded` and revokes new original signed URLs.
- Partial reversal sets entitlement to `fraud_hold` and revokes new original signed URLs.
- Blocking either direction prevents new signed URLs and new gift unlocks.

## V1 content constraints

- Text is mandatory and limited to 3,000 characters.
- Text-only, text plus one image, or text plus one allowlisted video link.
- `creator_post_media.post_id` is the primary key and `media_id` is unique, enforcing one image per post and one post per media asset.
- Image and video cannot coexist in one post.
- Video provider allowlist is HTTPS YouTube, youtu.be and OF.TV.
- All posts begin `pending_review`; non-owners only receive approved content.
