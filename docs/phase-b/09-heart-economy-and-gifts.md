# Phase B — Session 9: Heart Economy, Google Play Purchases and Gifts

## 1. Canonical backend

All Mobile Web, Android and iOS clients use the same Supabase project:

```text
Project: MyFan MobileApp
Project ref: asnydvqsduonyidjyyzq
Region: ap-southeast-1
```

The clients share one Auth population, product catalog, heart balance, gift history, Creator reward state, Fan membership state, generated database contract and Realtime stream.

## 2. Monetary model

```text
1 ❤️ = 100 integer units
Creator share = 7,000 basis points
Platform gross share = 3,000 basis points
```

Purchased hearts and Creator rewards are separate obligations:

- Purchased hearts are in-app value used to send digital gifts.
- Purchased hearts are not Creator earnings and are not withdrawable.
- Creator rewards are calculated only after a completed gift.
- Creator rewards move from pending to available after the configured hold.
- No financial calculation uses floating point columns.

## 3. Google Play heart products

Seven consumable product identifiers are seeded:

| Google product ID | Hearts | Units |
|---|---:|---:|
| `myfan_hearts_005` | 5 | 500 |
| `myfan_hearts_010` | 10 | 1,000 |
| `myfan_hearts_020` | 20 | 2,000 |
| `myfan_hearts_050` | 50 | 5,000 |
| `myfan_hearts_100` | 100 | 10,000 |
| `myfan_hearts_200` | 200 | 20,000 |
| `myfan_hearts_500` | 500 | 50,000 |

The database does not store Play Console prices as the authoritative display price. Native Android obtains localized pricing from Google Play Billing; the backend maps the verified product ID to units.

## 4. Purchase verification

`play-purchase-verify` is a JWT-protected Edge Function.

The Android flow is:

1. Android launches Google Play Billing for an active product.
2. Android sends the returned purchase token and product ID to the Edge Function.
3. The function authenticates the MyFan user.
4. The function obtains a Google service-account access token.
5. The Google Play Developer API returns `ProductPurchaseV2`.
6. The function requires purchase state `PURCHASED`.
7. The returned product ID must match the requested product ID.
8. `obfuscatedExternalAccountId` must equal SHA-256 of the MyFan user UUID.
9. The server hashes the purchase token and calls the service-role-only credit RPC.
10. The consumable purchase is consumed through Google Play.
11. The server records the consumed state.

The unique token hash and idempotency key prevent entitlement replay. A raw purchase token is not exposed in the public database contract.

Required deployment secrets:

```text
GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL
GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY
GOOGLE_PLAY_PACKAGE_NAME
```

Until these secrets and the production Android package name are configured, the function is deployed but returns a configuration error rather than granting hearts.

## 5. Gift catalog

Twenty neutral digital gifts are seeded at these prices:

```text
1, 2, 3, 5, 7, 10, 12, 15, 20, 25,
30, 35, 40, 50, 60, 70, 75, 80, 90, 100 ❤️
```

Each completed gift stores immutable snapshots of:

- Gift slug and names.
- Unit price.
- Quantity and gross units.
- Creator and platform basis points.
- Creator reward and platform gross units.

A later catalog edit cannot rewrite transaction history.

## 6. Financial storage

### Public with RLS

```text
public.heart_products
public.gift_catalog
public.gift_transactions
public.fan_progress
public.fan_memberships
public.economy_sync
```

### Private

```text
private.play_purchases
private.heart_accounts
private.heart_lots
private.heart_ledger
private.gift_funding_allocations
private.creator_earning_accounts
private.creator_reward_positions
private.creator_reward_ledger
private.purchase_reversal_events
private.creator_reward_liabilities
```

Client roles have no INSERT, UPDATE or DELETE grants on financial state. Private tables are absent from generated public types.

## 7. Atomic `send_gift`

`send_gift`:

- Requires an active adult sender.
- Requires an approved active adult Creator.
- Denies self-gifting and either-direction blocks.
- Validates active gift and quantity.
- Locks the sender account row.
- Uses an advisory lock and stable request UUID for idempotency.
- Rejects insufficient balance.
- Debits FIFO purchase lots.
- Appends the heart ledger entry.
- Creates the gift transaction snapshot.
- Calculates integer Creator/platform split.
- Creates the pending Creator reward position.
- Updates Fan progress and membership.
- Optionally creates a gift chat message only in an accepted-friendship conversation.
- Updates safe Realtime version signals.

All changes commit or roll back together.

## 8. Creator rewards

For a completed gift:

```text
creator_reward_units = floor(gross_units × creator_share_bps / 10,000)
platform_gross_units = gross_units − creator_reward_units
```

The second calculation absorbs integer remainder, preserving exact conservation.

Rewards begin as `pending`. `release_due_creator_rewards` moves eligible positions into `available` only when:

- The hold period has elapsed.
- Creator status remains approved.
- Payout eligibility remains enabled.
- The Creator reward account is not frozen.
- The gift has not been fully reversed.

## 9. Fan membership

`fan_progress` tracks lifetime and currently eligible support per Creator–Fan pair. When eligible support reaches the Creator threshold, `fan_memberships` becomes active.

This table is authoritative for Fan album access introduced in Session 8. Refund or revocation can reduce eligible support and revoke membership when it falls below threshold.

## 10. Refunds and revocations

The backend attributes every gift debit to FIFO purchase lots. This allows a refund or revocation to determine exactly:

- Unspent purchased units to debit.
- Gifts funded by that purchase.
- Creator rewards attributable to those gifts.
- Platform gross attributable to those gifts.
- Fan progress attributable to those gifts.

History is not deleted. Reversal entries and states are appended. If a Creator reward was already paid, the amount becomes a Creator liability rather than silently creating a negative balance.

## 11. Mobile Web, Android and iOS synchronization

All platforms import `@myfan/supabase` and share:

- One generated `Database` type.
- Catalog and balance queries.
- Purchase-history and gift-history queries.
- The same atomic `sendGift` wrapper.
- The same purchase-verification Edge Function client.
- The same Fan progress and membership queries.
- The same Realtime subscriptions.
- The same 100-unit conversion and formatting helpers.

Platform boundary:

- Android uses the native Google Play Billing library to obtain a real purchase token.
- Mobile Web and iOS use the same backend state and UI contract but cannot manufacture or directly credit a Google Play purchase.
- Business rules and ledger mutations stay in Supabase, not in platform UI code.

## 12. Realtime scope

Realtime publishes only safe metadata:

```text
public.gift_transactions
public.fan_progress
public.fan_memberships
public.economy_sync
```

`economy_sync` carries account version changes. Clients receive the signal and refresh private summaries through RPC. Purchase tokens, balances, ledgers and Creator reward positions are not published directly.

## 13. Applied migrations

```text
20260729195413_phase_b_09_catalog_purchase_heart_schema.sql
20260729195524_phase_b_09_gifts_rewards_fan_schema.sql
20260729195622_phase_b_09_economy_purchase_operations.sql
20260729195731_phase_b_09_gift_reward_operations.sql
20260729195833_phase_b_09_reversal_access_policies.sql
20260729200109_phase_b_09_add_fk_indexes.sql
```

## 14. Validation

Session 9 adds:

```text
09_heart_economy_gifts_test.sql: 65 pgTAP tests
09_concurrency.sh:              two independent PostgreSQL connections
```

Sessions 6–9 combined:

```text
161 pgTAP tests
```

The concurrency test gives one account exactly one gift's balance, launches two simultaneous gift requests and requires exactly one success, one gift transaction and one debit ledger entry.

## 15. Remote clean state after deployment

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

No test financial data remains in the canonical project.

## 16. Remaining release work

- Confirm the production Android application ID.
- Create the seven matching consumable products in Google Play Console.
- Configure service-account access and the three Edge Function secrets.
- Add the native Android purchase-sheet adapter and purchase recovery UI.
- Run a Google Play license-tester end-to-end purchase, consume, reinstall and refund test.
- Add RTDN ingestion and scheduled reconciliation before production scale.
- Implement KYC, withdrawal requests and manual payout operations in the next economy session.
