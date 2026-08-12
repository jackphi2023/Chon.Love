# LX-16 — Clone Interests + Messages Seeking → Luxy.Love

Status: IMPLEMENTED ON `agent/lx-16-interests-messages-seeking`; PR #34 open against `agent/luxy-seeking-ui-foundation`. Final merge gate pending. Not deployed to Supabase production.

## Visual source of truth

LX-16 uses the two Product Owner screenshots supplied on 2026-08-12 as the visual contract:

- `Interests-Seeking (1).png`
- `Messages-Seeking.png`

The frozen LX-00 rule remains in force: Seeking defines hierarchy, placement, restrained borders, typography rhythm and interaction pattern; Luxy changes brand, Vietnamese copy and product-specific entitlement only where required.

## Interests / Yêu thích

The previous photo-grid Favorites page was replaced by the Seeking row hierarchy:

- tab order: `Đã xem tôi` → `Yêu thích` → `Yêu thích tôi`;
- coral active underline;
- sort control on the right on desktop;
- portrait thumbnail with photo-count badge;
- online indicator, display name, headline, age and province/city;
- public profile facts including height and weight where present;
- interaction timestamp on the right;
- dark `Nhắn tin` pill and outlined `Yêu thích` pill;
- `Đã xem tôi` is limited to the previous 180 days and renders the same retention note shown by the Seeking reference.

Mobile web keeps the same information architecture. The three tabs flex across compact width without clipping, the sort control becomes full width, rows stack vertically, and 390px remains a required no-horizontal-overflow viewport.

Favorite remains free under the LX-14/LX-15 product policy and is not coupled to gifts, Fan state, private photos or messaging entitlement.

## Messages / Tin nhắn

The new mailbox route is `/(tabs)/messages` and follows the supplied Seeking composition:

- desktop two-column mailbox;
- left folder rail: `Tin nhắn đến`, `Đã lọc`, `Đã gửi`, `Lưu trữ`;
- mail search field;
- Inbox heading, unread-only checkbox, filter label and newest/oldest sort;
- restrained gray Diamond information strip;
- conversation rows with portrait, online state, member name, age/province, headline, timestamp and message preview;
- archive/restore action at row level;
- responsive mobile web preserves the same IA instead of introducing a separate bottom-tab messaging design.

`Đã lọc` currently represents conversations unavailable because of block state. No unsupported server-side spam classifier was invented merely to imitate a label in the screenshot.

## Required Luxy divergence from Seeking

The Seeking screenshot contains `Upgrade to read`. LX-16 intentionally does **not** copy that behavior because LX-15 established a different Luxy contract:

- FREE may receive and read conversations/messages addressed to them;
- FREE cannot start a new direct conversation and cannot send member-authored text;
- Premium/Diamond may start/send direct messages without accepted friendship;
- block, active-adult, moderation, idempotency, rate limits, read state and retention remain server-controlled.

Therefore a Free mailbox renders the real incoming preview and a restrained `Nâng cấp để trả lời` message rather than hiding the received text.

## Backend read-model additions

Migration:

- `supabase/migrations/20260812170000_lx_16_interests_messages_ui_contract.sql`

Changes:

1. Adds nullable `public.conversation_members.archived_at` as a per-member mailbox state.
2. Adds `public.set_conversation_archived(uuid, boolean)` as the narrow authenticated archive/restore boundary.
3. Extends `public.list_my_conversations(integer, integer)` with non-sensitive presentation fields:
   - age;
   - headline;
   - online state;
   - archive state.
4. Keeps the LX-15 `can_send`, block and recipient-availability rules unchanged.
5. Extends `public.list_luxy_interests(text, integer, integer)` with public headline/height/weight.
6. Enforces the Seeking 180-day window for `viewed_me`.

No legal identity, DOB, exact location, KYC data, bank data or billing data is exposed by the new read models.

## Shared client and UI

Added/reconciled:

- `packages/supabase/src/mailbox.ts`;
- `packages/supabase/src/interests.ts`;
- `apps/mobile/app/(tabs)/favorites.tsx`;
- `apps/mobile/app/(tabs)/messages.tsx`;
- `apps/mobile/src/components/luxy-seeking-member-photo.tsx`;
- `apps/mobile/src/components/luxy-seeking-message-button.tsx`;
- `apps/mobile/src/components/luxy-seeking-favorite-button.tsx`;
- `apps/mobile/src/components/luxy-shell-navigation.tsx`.

The authenticated shell now routes `Tin nhắn` to the LX-16 mailbox and can display incoming Interest and unread-message counts without changing the frozen Seeking navigation order.

`packages/supabase/src/database.types.ts` was regenerated from a clean local Supabase reset. Its LX-16 diff is limited to the intended archive field, new archive RPC, and added Interests/Messages read-model return fields.

## Verification

Added:

- `supabase/tests/lx_16_interests_messages_ui.sql`;
- `.github/workflows/lx16-contract.yml`;
- `packages/supabase/src/mailbox.test.ts`;
- updated `packages/supabase/src/interests.test.ts`;
- `tests/br-06/lx16-interests-messages-seeking.spec.mjs`;
- reconciled `tests/br-06/luxy-favorites.spec.mjs`.

The LX-16 database contract verifies:

- archive ACL/state;
- LX-15 direct messaging regression;
- Premium sender → Free recipient;
- Free read access with `can_send=false`;
- readable incoming text preview;
- mailbox public profile facts;
- archive/restore lifecycle;
- recent Viewed Me inclusion;
- public Interests row facts;
- exclusion after 180 days.

Browser coverage exercises desktop 1280×900 and compact mobile 390×844, including Interests hierarchy, Messages hierarchy, real archive/restore state and no horizontal overflow.

## Production boundary

PR #34 targets `agent/luxy-seeking-ui-foundation`, not `main`.

No Supabase production migration/deployment is part of LX-16. Production deployment remains a separate explicit release step.