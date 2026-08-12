# LX-15 — Seeking-style Direct Messaging Entitlement

Status: IMPLEMENTED ON `agent/lx-15-messaging-entitlement`; CI/merge gate pending.

## Product contract

LX-15 removes the legacy friendship prerequisite from Luxy.Love direct messaging while preserving the LX-14 paid interaction policy:

- FREE may browse and Favorite.
- FREE may receive/read a conversation and incoming messages addressed to them.
- FREE cannot start a direct conversation from Member Profile and cannot send member-authored text.
- Premium/Diamond may start a direct conversation and send text without first creating/accepting a friendship.
- Block, active-adult state, message moderation, idempotency, rate limits, read state, realtime and retention remain enforced.
- Gift/system messages are not reclassified as member-authored paid text.
- Existing friendship-backed conversations remain valid and are migrated to the same canonical direct-pair model.
- LX-17/LX-18 remain authoritative for real membership activation and billing.

## Database migration

`supabase/migrations/20260812161000_lx_15_direct_messaging_entitlement.sql`

Changes:

1. Adds canonical direct participants to `public.conversations`:
   - `direct_member_low_id`
   - `direct_member_high_id`
2. Backfills every existing conversation from its legacy friendship pair.
3. Makes `friendship_id` optional rather than fabricating a friendship for Seeking-style messaging.
4. Adds one unique conversation per canonical participant pair.
5. Keeps the legacy friendship acceptance trigger, but makes it link/reuse an existing direct conversation instead of creating a duplicate.
6. Reworks `get_direct_conversation`, `get_luxy_profile_conversation`, `get_conversation_detail`, `list_my_conversations`, `send_message` and `private.validate_message_insert` around conversation participants instead of accepted friendship.

## Safety and entitlement boundary

`get_luxy_profile_conversation(profile_id)` is now the paid get-or-create boundary:

- authenticated + active adult required;
- Premium/Diamond messaging entitlement required;
- target must be active/adult and available;
- self-message rejected;
- block in either direction rejected;
- canonical pair is protected by a transaction advisory lock + unique pair index;
- conversation member rows are inserted idempotently.

`send_message(...)` independently rechecks Premium/Diamond, conversation membership, block, active recipient, idempotency and both existing chat rate limits. The insert trigger repeats the paid-text/safety checks so direct inserts cannot bypass the RPC.

## Shared client

`packages/supabase/src/chat.ts` now accepts:

- nullable `friendship_id`;
- conversation context `direct` in addition to legacy friendship states;
- paid-membership and unavailable-target readable errors.

No separate web/native messaging implementation was introduced.

## Verification

Added:

- `supabase/tests/lx_15_direct_messaging_entitlement.sql`
- `.github/workflows/lx15-contract.yml`

The pgTAP contract covers:

- schema/ACL boundary;
- Premium creating a conversation with a Free user with zero friendship rows;
- canonical pair persistence;
- idempotent get-or-create;
- Premium send without accepted friendship;
- Free recipient read access;
- Free `can_send=false`;
- Free profile-CTA/send RPC bypass rejection;
- block enforcement;
- backward compatibility for accepted friendships without duplicate conversations.

The isolated workflow performs clean local database reset, reruns LX-14 regression, runs LX-15 pgTAP and database lint.

## Seeking UI boundary

LX-15 intentionally does not redesign the Messages list/detail pages; that is LX-16. Member Profile keeps the Seeking-derived message composer and upgrade gate implemented in LX-13/LX-14. The behavior under that UI is what changes: paid members now open/create a direct conversation without friendship.

## Production boundary

No Supabase production migration is applied in LX-15. Hosted Luxy.Love remains on the production release line until a separate deployment/release step is explicitly requested.
