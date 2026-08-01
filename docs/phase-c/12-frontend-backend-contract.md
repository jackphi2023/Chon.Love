# MyFan Phase C – Session 12 Frontend/Backend Contract

**Audited:** 2026-07-30  
**Repository:** `jackphi2023/myfan`  
**Supabase development project ref:** `asnydvqsduonyidjyyzq`  
**Decision:** native app, Expo Web/mobile web, public web and Admin use this one development project during Phase C.

## 1. Audit result

The branch contains the Phase A product, business-rule, screen-inventory, environment and monorepo foundation. The expected Phase B completion report, RLS matrix, security review and applied migration sources were not present in Git at Session 12 audit time, so the live development database was audited directly.

The live project contains Phase B migrations for sessions 6–11, RLS-enabled public tables, private financial/KYC tables, private Storage buckets and application RPCs. Purchases, heart-ledger entries, gift transactions, Creator-reward entries and withdrawals were all zero at audit time.

## 2. Corrected heart contract

| Rule | Value |
|---|---:|
| One displayed heart | `100 heart_units` |
| One heart conversion | `50,000 VND` |
| Gift #20 | `20 ❤️ = 1,000,000 VND` |
| Gift/social/profile/chat display | hearts only |
| VND display | top-up and withdrawal surfaces only |
| Creator share | `7,000 bps` / 70% |
| Platform gross share | `3,000 bps` / 30% |

Migration `phase_c_12_heart_vnd_rate_50000` updates future conversion configuration only. Historical snapshot tables are not rewritten.

## 3. Screen → query/RPC → permission → states

| Surface | Query/RPC/subscription | Permission | Loading, empty and error states |
|---|---|---|---|
| Public home | approved `profiles` + `creator_profiles`; public config | anon RLS; approved active Creator only | skeleton; hide empty section; generic retry |
| Public gift list | active `gift_catalog` ordered by `sort_order` | anon SELECT; server/Admin writes | skeleton; maintenance empty state; retry |
| Auth restore | Supabase Auth, then `get_my_onboarding_status()` | authenticated JWT | restore screen; suspended state; safe logout fallback |
| DOB/18+/Terms | `complete_my_onboarding(...)` | server calculates age; DOB private | field validation; under-18 blocked; policy-version error |
| My profile | self `profiles`; `update_my_profile(...)` | own row/RPC | skeleton; incomplete/pending review; retry |
| Province discovery | `administrative_areas`; `find_province_profiles(...)` | adult authenticated; blocked/inactive filtered | pagination; no results; retry |
| Nearby | platform location → `set_my_location`; `find_nearby_profiles` | user gesture; raw coordinates remain server-private | denied/timeout/low accuracy/stale/empty |
| Friendships | participant reads; request/respond/cancel RPCs | participants only | received/sent/friend empty states; rollback |
| Block/report | `block_user`, `unblock_user`, `create_report`, `get_my_reports` | self/reporter boundaries | confirm; receipt; idempotent retry |
| Conversations | conversations + members | accepted friendship/member only | skeleton; empty; reconnect |
| Chat | paginated messages; `send_message`; filtered Realtime | member; server checks friendship/block | optimistic rollback; dedupe; offline disabled |
| Media | prepare RPC → private Storage → finalize RPC | own path; MIME/size; moderation | progress; pending/approved/rejected/error |
| Gift catalog | active `gift_catalog` | public read; no client write | sorted; inactive hidden; no VND; send disabled |
| Creator Activity feed | `list_creator_activity(...)` | anon/authenticated; approved public posts or owner state | skeleton; empty; retry; keyset pagination |
| Creator Activity composer | media upload + `create_creator_activity_post(...)` + preview Edge Function | approved active Creator only | validation; upload; pending review; preview failure |
| Locked Activity image | preview Storage + `get_creator_post_media_access(...)` | owner, approved public image or active post entitlement | locked, preview-only, revoked, retry |
| Activity gift unlock | `send_gift_and_unlock_creator_post(...)` | adult authenticated; block-safe; active approved Creator/post/media | disabled flag, insufficient hearts, idempotent success, reversal |
| Activity moderation | queue + `moderate_creator_activity_post(...)` | moderator/super-admin only | loading, empty, role error, approve/reject |
| Economy | `get_my_economy_summary()` | self only; no direct private-ledger query | feature-disabled placeholder; safe retry |
| Account deletion | request/status/cancel RPCs | self only | confirmation; scheduled/grace/hold states |

## 4. Public, private and Realtime data

Public-safe data is limited to active administrative areas, active gifts, approved Creator presentation fields, approved Creator Activity text/link data, preview paths authorized by Storage policy and public application configuration. DOB, exact coordinates, pending media paths, locked originals, messages, reports, blocks, financial ledgers, purchase tokens, unlock-entitlement rows, KYC, bank and withdrawal data remain private/self-only.

The Realtime publication includes `messages`, `friendships`, `media_assets`, `gift_transactions`, `fan_progress`, `fan_memberships`, `economy_sync`, `payout_sync`, `albums`, `album_media` and `conversation_members`. Subscriptions must be resource-scoped, deduplicated and removed on unmount. Creator Activity V1 uses query invalidation rather than adding a global post subscription.

## 5. Storage

Audited private buckets include:

- `pending-media`: images, 10 MB;
- `profile-media`: approved profile media, 10 MB;
- `activity-previews`: derived blurred previews, 1 MB;
- `kyc-private`: image/PDF, 15 MB.

Creator Activity originals remain private. Gift-locked viewers receive a separate 64×64 server-generated blurred preview, not an original image blurred by client CSS. Original signed URLs expire after 30 seconds and require owner/public-image/active-entitlement or moderator authorization.

Clients must not construct public URLs or query arbitrary paths.

## 6. Phase C feature flags

```text
google_play_billing = false
send_gift = false
creator_wallet = false
creator_kyc = false
withdrawal = false
fan_album = true
creator_activity = true
creator_activity_links = true
creator_activity_gift_lock = true
creator_activity_public_web = true
push_notifications = false
native_deep_links = false
```

With `send_gift=false`, the Activity UI can display locked previews and the selected gift but cannot fake a charge, balance mutation or unlock success.

## 7. Creator Activity V1 contract

Every Creator Activity post must contain text. Exactly one of the following shapes is accepted:

1. text only;
2. text plus exactly one image;
3. text plus exactly one HTTPS video link from YouTube, youtu.be or OF.TV.

Multiple images and image-plus-video posts are rejected by component validation, RPC validation and database constraints. OF.TV is an external-link card, not an embedded WebView. The server does not perform arbitrary URL metadata fetches.

All posts begin `pending_review`. Public and authenticated non-owners only receive approved posts. An image post cannot be approved until the original image is approved and its server-derived preview is ready.

## 8. Contract gaps and deferred QA

1. Google Sign-In and Play Billing credentials are unavailable, so both remain disabled/foundation-only.
2. Native secure session persistence still requires dedicated-device verification.
3. The development project has no multi-user Creator Activity fixtures, so gift unlock, reversal, block behavior and moderator E2E remain beta QA.
4. The preview Edge Function is deployed and active, but an actual uploaded-image transformation has not been verified because no Creator/media fixture exists.
5. Public web uses static-export-compatible `/hoat-dong?u=username` rather than an unbounded dynamic route.

## 9. Security advisor review

Supabase Security Advisor reports project-wide warnings for client-callable `SECURITY DEFINER` RPCs. Creator Activity functions use fixed empty `search_path`, explicit `auth.uid()` or role checks, least-privilege direct grants, server-derived identities/prices and private entitlement tables. Only feed/media-access RPCs are callable by `anon`; Creator writes, gift unlock, report and Admin operations require authenticated access.

Performance Advisor reports unused-index information on the empty development database. No index is removed solely from that signal.
