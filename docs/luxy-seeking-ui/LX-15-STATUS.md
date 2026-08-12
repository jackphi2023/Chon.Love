# LX-15 — Seeking-style Direct Messaging Entitlement

Status: COMPLETED ON `agent/lx-15-messaging-entitlement`; Draft PR #33 open against `agent/luxy-seeking-ui-foundation`. Not deployed to production.

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

## Database migrations

- `supabase/migrations/20260812161000_lx_15_direct_messaging_entitlement.sql`
- `supabase/migrations/20260812162500_lx_15_message_authorization_order.sql`

Changes:

1. Adds canonical direct participants to `public.conversations`:
   - `direct_member_low_id`
   - `direct_member_high_id`
2. Backfills every existing conversation from its legacy friendship pair.
3. Makes `friendship_id` optional rather than fabricating a friendship for Seeking-style messaging.
4. Adds one unique conversation per canonical participant pair.
5. Keeps the legacy friendship acceptance trigger, but makes it link/reuse an existing direct conversation instead of creating a duplicate.
6. Reworks `get_direct_conversation`, `get_luxy_profile_conversation`, `get_conversation_detail`, `list_my_conversations`, `send_message` and `private.validate_message_insert` around conversation participants instead of accepted friendship.
7. Checks conversation membership before paid membership inside `send_message`, preventing a non-member conversation UUID probe from learning the caller's paid-membership error path.

## Safety and entitlement boundary

`get_luxy_profile_conversation(profile_id)` is the paid get-or-create boundary:

- authenticated + active adult required;
- Premium/Diamond messaging entitlement required;
- target must be active/adult and available;
- self-message rejected;
- block in either direction rejected;
- canonical pair protected by transaction advisory lock + unique pair index;
- conversation member rows inserted idempotently.

`send_message(...)` independently rechecks conversation membership, Premium/Diamond entitlement, block, active recipient, idempotency and both existing chat rate limits. The insert trigger repeats the paid-text/safety checks so a direct insert cannot bypass the RPC contract.

## Shared client

`packages/supabase/src/chat.ts` now supports:

- nullable `friendship_id`;
- conversation context `direct` in addition to legacy friendship states;
- paid-membership and unavailable-target readable errors.

`packages/supabase/src/database.types.ts` was regenerated from a clean local Supabase reset after the LX-15 migrations. The generated change is limited to the intended `conversations` contract: the two canonical participant columns plus nullable legacy `friendship_id`.

No separate web/native messaging implementation was introduced.

## Regression and verification

Added:

- `supabase/tests/lx_15_direct_messaging_entitlement.sql`
- `.github/workflows/lx15-contract.yml`

Reconciled:

- `supabase/tests/br_04_core_social_multi_account_e2e.sql`
- `scripts/validate-br04.mjs`

The LX-15 pgTAP contract covers:

- canonical participant schema and RPC ACL boundary;
- Premium creating a conversation with a Free user with zero friendship rows;
- idempotent get-or-create;
- Premium send without accepted friendship;
- Free recipient read access;
- Free `can_send=false`;
- Free profile-CTA/send RPC bypass rejection;
- block enforcement;
- backward compatibility for accepted friendships without duplicate conversations.

Final code head verification before this status-only commit:

- Application CI: PASS.
- Database full regression: PASS.
  - clean reset from repository migrations;
  - BR-01, BR-03, BR-04, BR-05, BR-06, BR-07, BR-08, BR-09;
  - LX-07, LX-09, LX-13, LX-14;
  - concurrent gift and withdrawal races;
  - schema lint;
  - exact generated public TypeScript contract;
  - application workspace verification.
- LX-15 Contract: PASS.
  - clean DB reset;
  - LX-14 regression;
  - LX-15 pgTAP;
  - schema lint.
- Browser E2E: PASS.

## Seeking UI boundary

LX-15 intentionally does not redesign the Messages list/detail pages; that is LX-16. Member Profile keeps the Seeking-derived message composer and upgrade gate implemented in LX-13/LX-14. The behavior under that UI changes only where required: paid members now open/create a direct conversation without friendship.

Therefore LX-15 introduces no alternate visual language and does not weaken the frozen Seeking UI fidelity specification.

## Production boundary

No Supabase production migration was applied in LX-15. Hosted Luxy.Love remains on the production release line until a separate deployment/release step is explicitly requested.

PR #33 remains Draft, targets `agent/luxy-seeking-ui-foundation`, and does not target or merge `main`.