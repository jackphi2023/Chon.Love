# OPT-00 — Chon.Love optimization baseline

Date: 2026-08-27 (Asia/Ho_Chi_Minh)

## Scope

This document freezes the starting point for the OPT-01 → OPT-16 optimization sequence. OPT-00 intentionally changes no product/business behavior, database schema, RLS policy, financial rule, AWS verification rule, or production Netlify feature flag.

## Git baseline

- Repository: `jackphi2023/Chon.Love`
- Source branch: `main`
- Frozen source SHA: `40d00bd6771bc887ed2e3c422a188ef5a33864ab`
- Source commit: `fix(seo): enforce homepage thumbnail release output (#106)`
- Integration branch: `release/chon-opt-v2`
- Merge policy: accumulate OPT work on the integration branch; do not merge `main` until OPT-15 global QA is green and OPT-16 release acceptance is complete.

## CI baseline at frozen main SHA

GitHub Actions CI run `33068326157` completed successfully for `40d00bd6771bc887ed2e3c422a188ef5a33864ab`.

The existing quality workflow covers:

- workspace/environment/security/integration/auth source contracts;
- core social and browser-E2E source validation;
- VietQR reconciliation source validation;
- KYC/withdrawal operation source validation;
- runtime quality, Netlify release, branding, public-profile SEO, Netlify Edge SEO;
- lint;
- typecheck;
- unit tests;
- Admin + canonical Expo Web build.

Important limitation: the normal CI job validates the browser-E2E source contract; the dedicated Browser E2E workflow is the runtime browser gate. OPT changes touching runtime code must keep that workflow green.

## Netlify baseline

Canonical repository config:

- build command: `bash scripts/build-netlify-web.sh`
- publish directory: `apps/mobile/dist`
- production Supabase project: `asnydvqsduonyidjyyzq`
- production feature flags currently disabled: `SEND_GIFT`, `CREATOR_WALLET`, `CREATOR_KYC`, `WITHDRAWAL`, Google Play Billing.

Do not enable those flags in OPT-00. They become explicit release dependencies for the gift/wallet/KYC/withdrawal sessions.

## Supabase production aggregate baseline

No user secrets, KYC contents, bank details, email addresses, or private media URLs are recorded here.

### Profiles and media

- Profiles: 63 total
  - `active`: 49
  - `deactivated`: 3
  - `incomplete`: 11
- `discovery_enabled = true`: 49
- `discovery_enabled = false`: 14
- Media moderation:
  - `approved`: 177
  - `pending_review`: 57
- Moderation cases:
  - `queued`: 57
  - `resolved`: 53

### Membership and economy

- Active Luxy/Chon paid membership records: 30
  - Premium active: 29
  - Diamond active: 1
- Gift catalog rows: 20
- Heart product rows: 9
- Gift transactions: 0
- Withdrawals: 0
- Historical `fan_memberships`: 0

The old `fan_memberships` table is not the Chon.Love Premium/Diamond source of truth. Paid membership state is currently backed by the private `luxy_memberships` contract and its public RPC boundary.

## Schema fingerprints

Fingerprints are MD5 hashes of ordered column contracts (name/type/nullability/default), not row data.

| Table | Columns | Fingerprint |
| --- | ---: | --- |
| `public.profiles` | 33 | `476d128bfae4bf6f708ff254f4b8a0b4` |
| `public.media_assets` | 20 | `eac55b4ddd7574b9efab5942ca2e45bc` |
| `public.moderation_cases` | 15 | `fb5546c8f9dd95076e517540f2d19119` |
| `public.gift_catalog` | 13 | `a5d706d1e935b4ea44d0dfda7be5c9f2` |
| `public.gift_transactions` | 25 | `2600644a137b71eef82dd49b419608e7` |
| `public.heart_products` | 8 | `776c8a3c06510addf76f2b55872803c0` |
| `private.withdrawals` | 30 | `b136c418d2aadbc85b10611c4ee8d4fb` |
| `private.withdrawal_reward_allocations` | 6 | `6ee0b6ee513dd846d9c78e9e903f3c06` |
| `private.kyc_profiles` | 20 | `86c7e6d31092ee075d03e11db6d694f6` |
| `private.kyc_documents` | 8 | `81c79fdb9bbf7d276e0b29d6147fdaac` |
| `private.bank_accounts` | 19 | `2843b85e5845bb4b968eda01a05ef121` |

`private.luxy_memberships` is also part of the protected membership contract and must not be mass-renamed during this optimization release.

## High-value RPC contract fingerprints

These provide drift detection for later OPT sessions:

- `activate_verified_signup_profile_v2(uuid)`: `c3c8b81b772ec9c318cc4661ebfcff9f`
- `get_public_chon_profile_v2(text)`: `c02fde616e6284c2111fe4344e4e6454`
- `resolve_chon_member_route(text)`: `4977795ca1a33ff63030b966d25c2d97`
- `search_luxy_profiles_v2(...)` current extended overload: `f6a4f57403cf7994b90fa76ca1f94f0e`
- `finalize_media_upload(uuid)`: `69f8389ae27f11d5ba80c8d6a3e0ae7f`
- `admin_list_member_photo_verifications(uuid,int,int)`: `9ceed5816f3a8585b25082829a5d737b`
- `admin_review_member_photo_verification(uuid,uuid,text,text,uuid)`: `daa2f3f9ab857af648a20946bd26afa6`
- `send_luxy_gift(...)`: `e46f7c9d964378fbeab38eae34392d73`
- `send_message(uuid,text,uuid)`: `d1f4e6ae2bdaa28a6ef44386e2e9e44a`
- `request_withdrawal(uuid,bigint,uuid)`: `6b9e981a38b27fb4d623ba7d7a8b6115`
- `admin_operate_withdrawal(...)`: `3ea5e2cba081b1b138abdf30d73ede04`

Later OPT migrations must deliberately update this baseline when a contract changes; accidental fingerprint drift is a review blocker.

## Required account baseline

The five public profile codes supplied for regression testing currently resolve in the database as follows:

| Public code | Profile | Discovery | Public avatar | Pending media | Approved media | Queued cases |
| --- | --- | --- | --- | ---: | ---: | ---: |
| `00b107` | active | true | no | 5 | 0 | 5 |
| `145084` | active | true | no | 2 | 0 | 2 |
| `9804d2` | active | true | no | 1 | 0 | 1 |
| `c5d896` | active | true | no | 3 | 0 | 3 |
| `774f74` | active | true | yes | 1 | 6 | 1 |

This is intentionally a baseline, not the desired final approval contract. OPT-01 → OPT-04 will change the Free-member listing semantics and Admin review behavior.

## Browser/runtime baseline

Existing browser infrastructure:

- dedicated Playwright Browser E2E workflow;
- deterministic local Supabase fixture stack;
- one Playwright worker;
- retained traces on failure;
- 390×844 mobile viewport coverage in the historical BR-06 lifecycle;
- browser workflow runs on `release/**` when runtime/test paths change.

Known production/runtime symptoms to preserve as baseline defects until their owning OPT session fixes them:

1. Homepage hero can visibly appear/jump late because the first configured slider URL is obtained only after the public homepage settings query resolves.
2. Connect user photos already use browser-native `loading="lazy"` and `decoding="async"`, but each card first resolves a media URL through its own query, leaving an N+1 latency path.
3. Admin photo moderation can hide recent pending items because the current queue path is oldest-first with a 50-item cap while 57 media rows are pending.
4. Gift/withdrawal production UI cannot be considered released while the corresponding Netlify production feature flags remain false.

## Performance baseline and target recording

OPT-00 does not change image delivery. The current source-level performance baseline is:

- Hero slider: first dynamic asset waits on homepage settings; next slide is prefetched; image uses force-cache and zero fade.
- Member photo web component: `loading=lazy`, `decoding=async` already enabled.
- Member photo data path: per-card URL query before `<img>` mount.

Wall-clock production timings are intentionally not invented here. Runtime timing gates will be collected on a Netlify HTTPS deploy preview in OPT-07/OPT-08 and again in OPT-15.

Target gates carried forward:

- hero CLS < 0.02;
- warm hero visible <= 200 ms when cache is available;
- mobile p75 LCP target <= 1.5 s on the agreed test profile;
- Connect warm thumbnail target around <= 100 ms, with representative p75 <= 300 ms after prefetch boundary;
- realtime chat online delivery p95 <= 2 s;
- zero horizontal overflow at 390/430/768/1024/1280/1440 widths.

## OPT-00 acceptance

OPT-00 is complete when:

- integration branch exists from the exact frozen main SHA;
- this baseline document is committed only to the integration branch;
- no production database write or schema change was made;
- no product/business logic or production feature flag was changed;
- branch CI is green after this documentation-only commit;
- dedicated browser runtime gates remain required for later runtime-changing OPT sessions.
