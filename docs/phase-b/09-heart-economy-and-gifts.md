# Phase B — Session 9: Heart Economy, Google Play Purchases and Gifts

## Canonical backend

All Mobile Web, Android and iOS clients use Supabase project `asnydvqsduonyidjyyzq` and share Auth, catalogs, balances, gift history, Creator rewards, Fan state, generated types and Realtime.

## Monetary model

```text
1 ❤️ = 100 integer units
Creator share = 7,000 basis points
Platform gross share = 3,000 basis points
```

Purchased hearts are non-withdrawable in-app value. Creator rewards are a separate liability. Financial columns use integer units only.

## Catalogs

Seven Google Play consumable IDs are seeded for 5, 10, 20, 50, 100, 200 and 500 hearts. Twenty neutral gifts are seeded at 1, 2, 3, 5, 7, 10, 12, 15, 20, 25, 30, 35, 40, 50, 60, 70, 75, 80, 90 and 100 hearts.

## Google Play verification

`play-purchase-verify` is JWT-protected. It verifies `ProductPurchaseV2`, requires `PURCHASED`, matches product ID and SHA-256-bound `obfuscatedExternalAccountId`, hashes the token, credits through a service-role-only RPC, consumes the product and records the consumed state.

Required deployment configuration:

```text
GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL
GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY
GOOGLE_PLAY_PACKAGE_NAME
```

Without these values the deployed function returns a configuration error and does not grant hearts.

## Financial data

Public RLS tables:

```text
heart_products
gift_catalog
gift_transactions
fan_progress
fan_memberships
economy_sync
```

Private financial tables include purchases, accounts, purchase lots, immutable ledgers, funding allocations, Creator reward positions, reversal events and paid-reward liabilities. Client roles have no direct financial mutation grants.

## Atomic gifting

`send_gift` validates adult active accounts, approved Creator status, blocks, gift state, quantity and available balance. It uses advisory and row locks, FIFO purchase-lot attribution, immutable ledger entries, exact 70/30 integer split, pending Creator rewards, authoritative Fan progress and optional gift chat messages. All effects commit or roll back together.

## Refund and revocation

Purchase-lot attribution identifies exact unspent and spent units. Reversal entries update gift, Creator reward and Fan state without deleting history. Already-paid Creator reward becomes a tracked liability rather than a negative balance.

## Cross-platform synchronization

All platforms import `@myfan/supabase` and share generated types, catalog/balance/history queries, `sendGift`, purchase verification, Fan queries, unit formatting and Realtime subscriptions. Android alone supplies the genuine Google Play purchase token; Web and iOS cannot directly credit a purchase.

Realtime publishes only:

```text
gift_transactions
fan_progress
fan_memberships
economy_sync
```

## Migration history

Substantive migrations:

```text
20260729195413_phase_b_09_catalog_purchase_heart_schema.sql
20260729195524_phase_b_09_gifts_rewards_fan_schema.sql
20260729195622_phase_b_09_economy_purchase_operations.sql
20260729195731_phase_b_09_gift_reward_operations.sql
20260729195833_phase_b_09_reversal_access_policies.sql
20260729200109_phase_b_09_add_fk_indexes.sql
20260729201435_phase_b_09_add_liability_gift_index.sql
```

History alignment entries with no business-data or permission change:

```text
20260729200855_phase_b_09_edge_function_marker.sql
20260729200911_phase_b_09_edge_function_marker.sql
20260729200945_phase_b_09_noop_history_alignment.sql
```

## Validation

Session 9 adds 65 pgTAP tests and a true two-connection concurrent gift test. Sessions 6–9 total 161 pgTAP tests. Exact generated-type comparison prevents schema drift.

Remote clean state after deployment:

```text
Heart products:          7
Gift catalog rows:       20
Auth users:               0
Play purchases:           0
Gift transactions:        0
Heart ledger entries:     0
Creator reward entries:   0
Fan memberships:          0
```

## Remaining release work

- Confirm production Android application ID.
- Create the seven matching products in Play Console.
- Configure Google service-account secrets.
- Add native Android Billing adapter and recovery UI.
- Run license-tester purchase, consume, reinstall and refund E2E tests.
- Add RTDN and reconciliation before production scale.
- Implement KYC, withdrawal requests and manual payouts in the next session.
