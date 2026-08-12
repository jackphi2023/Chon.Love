# LX-14 — Private Photo + paid profile interaction gates

Status: COMPLETED IN ROADMAP FOUNDATION — policy correction under verification.

## Product policy implemented

LX-14 keeps Private Photo access explicit and owner-controlled, with the corrected 2026-08-12 member-profile interaction policy:

- FREE may browse eligible member profiles.
- FREE **may add/remove Favorite / Interest**.
- FREE cannot **request Private Photo access**.
- FREE cannot **send text messages**.
- On Member Profile, a FREE member pressing Message or Request Private Photo opens the shared Seeking-inspired upgrade modal.
- The modal compares **Premium** and **Diamond**, including the implemented benefits of each tier and a separate upgrade handoff for each plan.
- Premium/Diamond may send messages and may request Private Photo access subject to existing safety/status rules.
- Private Photo approval remains mandatory even for Premium/Diamond; paid membership only permits the request and continued viewing of an approved grant.
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
- `supabase/migrations/20260812145600_lx_14_free_favorite_paid_message_private.sql`

RPC / server boundaries:

- `get_private_photo_access_state`
- `request_private_photo_access`
- `respond_private_photo_access`
- `revoke_private_photo_access`
- `list_received_private_photo_requests`
- `list_profile_private_media`
- `get_luxy_profile_conversation`
- `send_message` + `private.validate_message_insert()` hard gate for authenticated member-authored text

Membership snapshot:

- `can_favorite = true` for every active-adult Luxy member, including FREE.
- `can_message` remains a Premium/Diamond entitlement.
- `can_request_private_photo` remains a Premium/Diamond entitlement.

`set_profile_favorite` preserves safety/block/active-target checks but no longer applies a paid-membership gate.

## UI

Shared contextual upgrade modal is used for the two paid profile actions:

- Message → `Bắt đầu nhắn tin ngay!`
- Private Photo → `Xem ảnh riêng tư!`

The modal presents two plans:

- **Premium**: member messaging, Private Photo request capability, Premium badge.
- **Diamond**: all Premium interaction rights plus Diamond membership badge / highest membership tier.

Both plans have separate upgrade handoffs. The modal explicitly states that Favorite remains free and that Private Photo still requires owner approval after upgrade.

Member Profile renders real Private Photo request state and approved private images. Settings → Private Photos includes request approve/decline/revoke management.

## Verification

Database contract:

- `supabase/tests/lx_14_private_photo_premium_entitlements.sql`

The contract verifies FREE Favorite add/remove, FREE bypass prevention for Private Photo requests and text-message inserts, Premium messaging/request flow, owner-only Private Photo approval, approval/revocation, paid re-check at view time, and absence of gift/Fan unlock paths.

Browser E2E verifies on desktop and 390px mobile web that FREE can Favorite without a paywall, while Message and Private Photo show the Premium/Diamond comparison modal.

Production Supabase deployment remains intentionally out of scope until a separate deployment/release step is requested.
