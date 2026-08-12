# LX-14 — Private Photo Album

## Goal
LX-14 adds owner-controlled access to private profile photos without turning private media into a paid entitlement.

## Member flow
1. Owner uploads a photo with `visibility=private` from Settings.
2. Upload continues through the existing `pending-media` moderation pipeline.
3. `finalize_media_upload` attaches private media to an active `album_type=private` album.
4. Other active adult members see only a locked card and a safe photo count.
5. Requester selects **Gửi yêu cầu xem ảnh**.
6. Owner sees the request in Settings and can **Chấp nhận** or **Từ chối**.
7. Approved access is open-ended until the owner revokes it.
8. A later block, deactivated account, under-age/incomplete compliance state, or owner revoke immediately removes effective access.

## Privacy boundary
Before approval, `get_private_photo_access_state` exposes only:
- owner id;
- private photo count;
- request id/status/timestamps;
- boolean `can_view`.

It does not return media ids, Storage buckets or object paths. Private image rows become visible through the existing `list_profile_album_media` RPC only after the server-side grant check passes. Existing private Storage signing remains authoritative.

## Authorization model
`public.private_photo_access_requests` is RPC-only for authenticated clients. Direct table SELECT/INSERT/UPDATE/DELETE privileges are revoked. Effective access requires all of:
- request row is `approved` and not revoked;
- owner and requester are active adults;
- neither user blocks the other;
- media belongs to an active private album owned by the target;
- media is eligible under the current moderation policy.

Premium/Diamond membership, gifts, balances and any future payment state are intentionally absent from this decision. Payment never bypasses owner approval.

## UX contract
The locked-card modal follows the supplied Seeking reference visually: dimmed backdrop, centered white rounded card, warm-gold privacy icon, prominent red/pink primary CTA and a quiet secondary action. Copy is about consent/request approval, not subscription upsell.

States:
- `not_requested`: request CTA enabled;
- `pending`: waiting for owner;
- `approved`: private album images load through canonical media access;
- `rejected`: requester may ask again;
- `revoked`: requester may ask again;
- blocked/unavailable: private access UI is not actionable.

## Owner controls
`/settings/private-photos` remains the upload/library surface and gains:
- pending request queue;
- Accept / Reject actions;
- approved-grant list;
- Revoke access action.

## Database contract
Migration: `supabase/migrations/20260812133000_lx_14_private_photo_album.sql`

Test: `supabase/tests/lx_14_private_photo_album.sql`

RPCs:
- `get_private_photo_access_state(uuid)`
- `request_private_photo_access(uuid)`
- `list_my_private_photo_access_requests(private_photo_access_status)`
- `respond_to_private_photo_access_request(uuid, boolean)`
- `revoke_private_photo_access(uuid)`

## Deferred
- LX-15 final Direct Messaging entitlement/new-conversation behavior.
- LX-17/LX-18 full membership engine and billing.

## Release status
LX-14 is developed and tested on the roadmap branch. This document does not imply a Supabase production deployment.