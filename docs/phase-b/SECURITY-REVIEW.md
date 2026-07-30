# MyFan Security Review

**Updated:** 2026-07-30  
**Review scope:** supplemental Creator Activity and its interaction with existing Phase B media, gift ledger, moderation and account-safety contracts.

## Security conclusion

The Creator Activity implementation uses RPC and Storage authorization as the security boundary. Client state such as `is_unlocked`, selected gift, Creator ID, price or original image URL is never accepted as proof of access.

The V1 scope is deliberately limited to required text, optional exactly one image, or optional exactly one allowlisted video link. Multiple images and image-plus-video posts are rejected at component, RPC and database levels.

## Original-image protection

- Original Activity images use existing private media upload flows with `visibility=private`.
- A JWT-protected Edge Function reads the original only after an owner authorization RPC succeeds.
- The function writes a separate 64×64 blurred preview to the private `activity-previews` bucket.
- Locked feed RPC output omits original bucket and path before an active entitlement exists.
- Storage policy rechecks post/media moderation, Creator state, adult state, two-way block state and entitlement before a signed original can be created.
- Signed URLs expire after 30 seconds.
- No original signed URL is logged or embedded in public HTML.

This avoids the insecure pattern of downloading an original image and applying client-side CSS blur.

## Gift and entitlement integrity

`send_gift_and_unlock_creator_post` runs as one database transaction and reuses the existing `send_gift` engine, immutable heart ledger and 70% Creator reward calculation.

The caller supplies only the exact post ID and an idempotency key. The server derives:

- current viewer from `auth.uid()`;
- Creator from the approved post;
- required gift and unit price from the post snapshot and active catalog;
- entitlement status from the private table.

A transaction-level advisory lock serializes one viewer/post pair. Existing active entitlement returns without charging again. A replayed idempotency key must match the same completed gift transaction and post target.

Full reversals revoke access as `refunded`; partial reversals place access in `fraud_hold`. Both stop new original signed URLs. Events are appended to a private entitlement audit table.

The current frontend keeps `send_gift=false`, so no real balance mutation or fake unlock success is exposed before Google Play Billing is enabled.

## URL and SSRF review

Accepted URLs must use HTTPS and match one of:

- YouTube watch URLs;
- youtu.be URLs;
- YouTube shorts/embed URLs;
- OF.TV content paths.

YouTube URLs are normalized to an 11-character video ID and a canonical URL. OF.TV remains an external-link card with an interstitial; it is not embedded in a WebView.

V1 does not perform arbitrary server-side metadata retrieval, follow redirects or resolve user-supplied hosts. Therefore the implementation has no generic URL-fetch SSRF surface. Tests reject HTTP, arbitrary domains, localhost, loopback and look-alike YouTube domains.

No email, internal user ID, access token, purchase token or location is appended to an external URL.

## Moderation review

- All posts start `pending_review`.
- Text, external link and image are reviewed before publication.
- An image post cannot be approved until the original media is approved and the server preview is ready.
- Gift-locked media follows the same moderation standard as public media.
- Moderator and super-admin operations use role-checked RPCs.
- Approve/reject actions write before/after values and request ID to private Admin audit logs.
- Users can report a post, specific image or external link; duplicate reports within 60 seconds are rate limited.

## RLS and ACL review

- RLS is enabled for all new public and private tables.
- `anon` and `authenticated` have no direct write grants on post or entitlement tables.
- Entitlement rows are never directly exposed to clients.
- Only public feed and media-access RPCs are granted to `anon`.
- Creator write, gift unlock, report and Admin RPCs require `authenticated`.
- SECURITY DEFINER functions use fixed empty `search_path` and explicit identity or role checks.
- The direct ACL audit found and removed default `anon` EXECUTE grants from write/Admin RPCs.

## Block and account-state review

Two-way blocks prevent public feed access, original signed URLs, new gift unlocks and reporting against inaccessible content. Suspended/inactive Creators and non-active adult accounts cannot publish or unlock content through the new RPCs.

## Public web review

The public Activity route is `/hoat-dong?u=username` to remain compatible with static export. It is noindex, reads only approved posts, never queries private entitlement rows and cannot execute anonymous gift transactions.

## Known limitations requiring beta QA

The development database currently has no profiles, posts, media, gift transactions or moderator fixtures. The following are not yet proven by end-to-end device tests:

- real image upload through Android and Expo Web;
- ImageMagick preview generation using a real uploaded file;
- two-account unlock and immediate cache invalidation;
- full and partial reversal against a real gift transaction;
- block behavior across two active accounts;
- moderator login and decision workflow;
- exact signed-URL expiry timing on physical clients;
- accessibility and dynamic-font behavior.

These limitations do not change the implemented authorization contracts, but production release should not proceed until the fixtures and device checks pass.
