# LX-14 — Private Photo + Premium profile interaction gates

Status: COMPLETED IN ROADMAP FOUNDATION.

## Product policy implemented

LX-14 keeps Private Photo access explicit and owner-controlled, and applies the 2026-08-12 Premium policy override to member-profile interactions:

- FREE may browse eligible member profiles.
- FREE cannot **add Favorite / Interest**.
- FREE cannot **request Private Photo access**.
- FREE cannot **start messaging from the Member Profile CTA**.
- Those three actions open the shared Luxy Premium upgrade modal inspired by the supplied Seeking reference.
- Premium/Diamond may perform the actions subject to the existing safety/status rules.
- Private Photo approval remains mandatory even for Premium/Diamond; paid membership only permits the request and continued viewing of an approved grant.
- A downgraded member may always **remove** an existing Favorite.
- Creating an upgrade intent never activates membership and never charges the member.

## Private Photo workflow

1. Owner uploads media with `visibility = private` through the existing moderated media pipeline.
2. Private Photo classification excludes private Storage media attached to Creator Activity posts.
3. Premium/Diamond viewer sends `request_private_photo_access(owner_id)`.
4. Owner sees the request under Settings → Private Photos.
5. Owner approves or declines.
6. Approved media is returned by `list_profile_private_media(owner_id)` only while the viewer still has an active paid membership and safety checks continue to pass.
7. Owner may revoke an approved request at any time.
8. Block/inactive/downgrade removes effective access immediately.

Private-photo grants are stored in `private.private_photo_access_requests`; authenticated clients have no direct table access.

## Explicit non-goals / boundaries

- Gift transactions do **not** unlock Private Photos.
- Fan membership does **not** unlock Private Photos.
- Friendship state does **not** unlock Private Photos.
- LX-15 still owns removal of the legacy friendship prerequisite and the final messaging/conversation entitlement architecture.
- LX-17/LX-18 remain the authoritative future membership engine and billing/checkout implementation.

## Backend contracts

Migrations:

- `supabase/migrations/20260812121500_lx_14_private_photo_premium_interactions.sql`
- `supabase/migrations/20260812121600_lx_14_restore_storage_helper_acl.sql`
- `supabase/migrations/20260812121700_lx_14_private_photo_media_classification.sql`

RPCs:

- `get_private_photo_access_state`
- `request_private_photo_access`
- `respond_private_photo_access`
- `revoke_private_photo_access`
- `list_received_private_photo_requests`
- `list_profile_private_media`
- `get_luxy_profile_conversation`

Membership snapshot gains:

- `can_favorite`
- `can_request_private_photo`

`set_profile_favorite` is replaced so adding a Favorite requires active Premium/Diamond while removal remains available.

## UI

Shared contextual upgrade modal supports:

- Message → `Bắt đầu nhắn tin ngay!`
- Favorite / Interest → `Mở khóa Interest!`
- Private Photo → `Xem ảnh riêng tư!`

CTA: `Nâng cấp Premium` → membership settings/upgrade handoff.

Member Profile renders real Private Photo request state and approved private images. Settings → Private Photos includes request approve/decline/revoke management.

## Verification

Database contract:

- `supabase/tests/lx_14_private_photo_premium_entitlements.sql`

The contract verifies FREE bypass prevention, Premium request flow, owner-only approval, approval/revocation, paid re-check at view time, Favorite downgrade removal, profile-message paid gate, and absence of gift/Fan unlock paths.

Browser E2E includes a dedicated approved Private Photo fixture that is deliberately separate from Creator Activity media, and verifies the Seeking-inspired `Xem ảnh riêng tư!` Premium gate on both desktop and 390px mobile web.

Production Supabase deployment remains intentionally out of scope until a separate deployment/release step is requested.
