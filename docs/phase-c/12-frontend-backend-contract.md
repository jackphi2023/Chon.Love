# MyFan Phase C – Session 12 Frontend/Backend Contract

**Audited:** 2026-07-30  
**Repository:** `jackphi2023/myfan`  
**Working branch:** `feature/phase-c-core-app-web`  
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
| Economy | `get_my_economy_summary()` | self only; no direct private-ledger query | feature-disabled placeholder; safe retry |
| Account deletion | request/status/cancel RPCs | self only | confirmation; scheduled/grace/hold states |

## 4. Public, private and Realtime data

Public-safe data is limited to active administrative areas, active gifts, approved Creator presentation fields and public application configuration. DOB, exact coordinates, pending media paths, messages, reports, blocks, financial ledgers, purchase tokens, KYC, bank and withdrawal data remain private/self-only.

The Realtime publication includes `messages`, `friendships`, `media_assets`, `gift_transactions`, `fan_progress`, `fan_memberships`, `economy_sync`, `payout_sync`, `albums`, `album_media` and `conversation_members`. Subscriptions must be resource-scoped, deduplicated and removed on unmount.

## 5. Storage

Audited private buckets:

- `pending-media`: images, 10 MB;
- `profile-media`: approved profile media, 10 MB;
- `kyc-private`: image/PDF, 15 MB.

Clients must not construct public URLs or query arbitrary paths.

## 6. Phase C feature flags

```text
google_play_billing = false
send_gift = false
creator_wallet = false
creator_kyc = false
withdrawal = false
fan_album = false
push_notifications = false
native_deep_links = false
```

## 7. Contract gaps

1. Phase B source reports/migrations are missing from Git and should be recovered from the applied database history.
2. Live `gift_catalog` has 20 active gifts but prices `1,2,3,5,7,10,12,15,20,25,30,35,40,50,60,70,75,80,90,100`; Session 19 must migrate future catalog prices to exactly `1–20 ❤️` without changing historical snapshots.
3. Approved private media needs a client-safe signed-delivery operation before public profile images are shown.
4. Current Terms and Community Standards version keys are not exposed in public config before Session 14.
5. Profile interests are absent from the audited schema.
6. No narrow conversation-summary RPC was found; avoid N+1 queries in Session 18.
7. Google Sign-In and Play Billing credentials are not available, so both remain disabled/foundation-only.
8. Native session persistence intentionally remains off in Session 12 until secure storage is integrated and tested in Session 14.

## 8. Security advisor review

Supabase Security Advisor reports warnings for client-callable `SECURITY DEFINER` RPCs. Each must be reviewed for explicit `auth.uid()`/role checks, fixed `search_path`, least-privilege EXECUTE grants and rejection of caller-supplied identity. This remains an open Phase B security-review gap, not an accepted safe default.

Performance Advisor reports only unused-index information. The database is empty, so no index was removed.
