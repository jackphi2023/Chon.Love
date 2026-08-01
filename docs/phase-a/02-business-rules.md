# MyFan V1 — Heart Economy & Creator Reward Business Rules

- **Document:** Phase A / Session 2
- **Status:** Approved business-rule foundation for V1 implementation
- **Last reviewed:** 2026-07-29
- **Applies to:** Mobile app, Admin web, Public web, Google Play purchase verification, Supabase database, Edge Functions, ledgers, reconciliation, Creator KYC, withdrawals, refunds and Fan access
- **Depends on:** `docs/phase-a/01-product-positioning.md`

## 1. Purpose and non-negotiable invariants

This document defines the canonical V1 rules for ❤️, digital gifts, Creator rewards, Fan access, refunds and withdrawals.

The following invariants are mandatory:

1. MyFan is a Social Creator platform, not a peer-to-peer money-transfer service.
2. Purchased ❤️ can be used only inside MyFan and can never be withdrawn.
3. Creator earnings are a separate platform reward obligation and are never stored in the same balance as purchased ❤️.
4. All financial calculations use integers. Floating-point arithmetic is prohibited.
5. Creator reward defaults to 70% of eligible gift value; platform gross share defaults to 30%.
6. Google Play fees, taxes, refunds and settlement differences do not reduce the promised 70% Creator reward unless the underlying gift is reversed or refunded.
7. Financial history is immutable. Corrections are new ledger entries, never edits to prior entries.
8. Purchase, gift, refund, reward and withdrawal commands must be idempotent and auditable.
9. VNĐ is displayed only in approved purchase and withdrawal contexts. Social surfaces display ❤️ only.
10. Fan benefits never purchase meetings, relationships, sexual access, private contact or adult content.

---

## 2. Heart unit

### 2.1 Canonical definition

```text
1 ❤️ = 10,000 VNĐ
1 ❤️ = 100 heart_units
1 heart_unit = 100 VNĐ
```

Canonical constants for V1:

```text
HEART_UNITS_PER_HEART = 100
DEFAULT_VND_PER_HEART = 10000
BASIS_POINTS_DENOMINATOR = 10000
```

`HEART_UNITS_PER_HEART` is a currency-definition invariant. It must not be changed through runtime configuration after financial records exist. A future currency-unit migration would require a versioned migration and reconciliation plan.

`heart_vnd_rate` is configurable for future business changes, but each financial transaction must store the rate snapshot used at the time of calculation.

### 2.2 Why integer `heart_units` are mandatory

Floating-point values such as `0.1`, `0.7` or `70%` cannot always be represented exactly in binary arithmetic. Using float values can create rounding drift, mismatched balances and reconciliation errors.

All values are therefore stored as signed integers in `heart_units`:

```text
1 ❤️     = 100 units
0.70 ❤️  = 70 units
0.30 ❤️  = 30 units
10 ❤️    = 1,000 units
100 ❤️   = 10,000 units
```

Example for a 1 ❤️ gift:

```text
gross_heart_units       = 100
creator_reward_units    = 70
platform_gross_units    = 30
```

No database column, API contract or calculation may use float/decimal hearts as the source of truth.

### 2.3 Display rules

| Surface | Display rule |
|---|---|
| Profile, discovery, chat, gifts, Fan progress, album, rankings | ❤️ only |
| Heart purchase screen | ❤️ and Google Play localized purchase price; VNĐ may be shown for Vietnamese users |
| Purchase history | ❤️ plus actual charged currency/amount where appropriate |
| Creator earnings overview | ❤️ only by default |
| Withdrawal request and withdrawal history | ❤️ and VNĐ |
| Admin finance and reconciliation | heart units, ❤️, VNĐ and actual settlement currency as required |

The app must not display VNĐ in the gift catalog, gift confirmation inside chat, profile support totals, Fan Album, social rankings or public Creator profile.

---

## 3. Heart balance and Creator earnings are separate assets

### 3.1 User heart balance

`heart_balance` represents purchased virtual value:

- Credited only after server-side validation of an eligible Google Play purchase or an audited adjustment.
- Used only for eligible MyFan digital gifts or future approved in-app benefits.
- Not withdrawable.
- Not transferable as cash.
- Not a bank deposit, stored-value account, remittance balance or peer-to-peer payment balance.
- Derived from the immutable `heart_ledger`; a cached balance may exist for performance but is not the accounting source of truth.

Suggested derived balances:

```text
heart_balance_total_units
heart_balance_spendable_units
heart_balance_held_units
heart_balance_debt_units
```

### 3.2 Creator earnings

`creator_earnings` represents MyFan's reward obligation to an eligible Creator:

- Created from the Creator share of completed, eligible gifts.
- Separate from the Creator's own purchased ❤️.
- Subject to pending hold, fraud checks, KYC, bank approval and withdrawal review.
- Derived from the immutable `creator_reward_ledger`.
- Can have `pending`, `available`, `held`, `paid` and `reversed` amounts.

Suggested derived balances:

```text
creator_pending_units
creator_available_units
creator_held_units
creator_paid_units
creator_reversed_units
creator_recovery_units
```

### 3.3 Prohibited implementation

The following design is prohibited:

```text
wallet_balance
```

A single mutable wallet balance would incorrectly mix purchased virtual currency with withdrawable Creator rewards and would make refund, accounting, RLS and fraud controls unsafe.

---

## 4. Heart packages — Google Play Billing products

### 4.1 Initial package catalog

| Package code | Google Play product ID proposal | Credited value |
|---|---|---:|
| HEARTS_005 | `myfan.hearts.005` | 5 ❤️ / 500 units |
| HEARTS_010 | `myfan.hearts.010` | 10 ❤️ / 1,000 units |
| HEARTS_020 | `myfan.hearts.020` | 20 ❤️ / 2,000 units |
| HEARTS_050 | `myfan.hearts.050` | 50 ❤️ / 5,000 units |
| HEARTS_100 | `myfan.hearts.100` | 100 ❤️ / 10,000 units |
| HEARTS_200 | `myfan.hearts.200` | 200 ❤️ / 20,000 units |
| HEARTS_500 | `myfan.hearts.500` | 500 ❤️ / 50,000 units |

Final Play Console product IDs must be confirmed before production and, once published, treated as stable identifiers.

### 4.2 Purchase rules

1. Heart packages are the Google Play Billing products. Individual gifts are not separate Play products.
2. The client starts the Billing flow but must not credit ❤️ from a client callback alone.
3. The client sends the purchase token and product identifier to a server-side verification function.
4. The server validates product, package, purchase state, token uniqueness and entitlement.
5. A valid, previously unprocessed purchase creates one purchase record and one heart-credit ledger entry atomically.
6. `purchase_token` and order identifiers must be unique and protected from logging or public exposure.
7. The operation requires an idempotency key in addition to the unique purchase token.
8. The purchase is acknowledged or consumed according to the final Billing implementation only after the server has safely persisted the entitlement.
9. Localized price and actual settlement information must be stored for accounting; they do not alter the fixed number of credited heart units for that product version.
10. VietQR, bank transfer, Google Pay as an external substitute, or web checkout must not appear in the Android in-app flow for digital ❤️ unless a separately approved program and legal review allows it.

### 4.3 Purchase state model

Recommended purchase states:

```text
initiated
pending
verified
credited
acknowledged
refunded
revoked
cancelled
verification_failed
fraud_hold
```

A purchase may be credited only once. Repeated server calls must return the existing result and must never create duplicate heart credits.

---

## 5. Gift catalog

### 5.1 Canonical V1 price points

MyFan V1 has 20 active gift price points:

```text
1, 2, 3, 5, 7,
10, 12, 15, 20, 25,
30, 35, 40, 50, 60,
70, 75, 80, 90, 100 ❤️
```

Equivalent `heart_price_units`:

```text
100, 200, 300, 500, 700,
1000, 1200, 1500, 2000, 2500,
3000, 3500, 4000, 5000, 6000,
7000, 7500, 8000, 9000, 10000 units
```

### 5.2 Catalog rules

Each catalog item requires at minimum:

```text
id
code
name_vi
name_en
icon_url
heart_price_units
sort_order
is_active
created_at
updated_at
```

Rules:

1. Gifts are internal digital items consumed inside MyFan.
2. Gift names, icons and copy must follow the Social Creator positioning and content standards.
3. Gift price is shown only in ❤️ on Social surfaces.
4. The current gift name, icon reference and price must be snapshotted into the gift transaction.
5. Updating a catalog item must not change historical transactions.
6. A gift with transaction history is deactivated with `is_active = false`; it is not physically deleted.
7. Admin price changes require authorization and an audit record.
8. A gift transaction uses the server-side catalog price, never a price supplied as authoritative by the client.

---

## 6. Creator split and fee treatment

### 6.1 Default split

```text
creator_share_bps = 7000       # 70%
platform_share_bps = 3000      # 30%
creator_share_bps + platform_share_bps = 10000
```

Percentages are stored as integer basis points:

```text
70% = 7000 bps
30% = 3000 bps
15% = 1500 bps
```

The configuration service must reject a split where creator and platform basis points do not total 10,000.

### 6.2 Integer formulas

```text
creator_reward_units = floor(gross_heart_units * creator_share_bps / 10000)
platform_gross_units = gross_heart_units - creator_reward_units
```

Any integer remainder is assigned deterministically to `platform_gross_units` so that:

```text
creator_reward_units + platform_gross_units = gross_heart_units
```

With the V1 gift prices and a 70/30 split, calculations are exact because each gift value is a multiple of 100 units.

Example — 100 ❤️ gift:

```text
gross_heart_units        = 10,000
creator_reward_units     = 7,000   # 70 ❤️
platform_gross_units     = 3,000   # 30 ❤️
```

### 6.3 Google Play fee

`estimated_google_fee_bps` defaults to 1,500 bps only for forecasting. It is not a core transaction rule and must not be hard-coded into gift or Creator reward calculations.

Required accounting fields should support:

```text
estimated_google_fee_bps
estimated_google_fee_amount
actual_google_fee_amount
actual_google_settlement_amount
tax_amount
settlement_currency
settlement_period
```

Platform reporting formula:

```text
platform_net = actual_google_settlement
               - creator_reward_value
               - applicable_taxes
               - refunds
               - other directly attributable settlement adjustments
```

The actual Google fee must not be deducted from the Creator's 70% reward. If the underlying purchase or gift is legitimately refunded, revoked or reversed, the corresponding reward may be reversed under Section 10.

Example forecast for 100 ❤️:

| Item | ❤️ equivalent | VNĐ equivalent |
|---|---:|---:|
| User purchases and sends | 100 ❤️ | 1,000,000 |
| Creator reward | 70 ❤️ | 700,000 |
| Platform gross share | 30 ❤️ | 300,000 |
| Estimated Google fee | 15 ❤️ | 150,000 |
| Estimated platform net before tax/other adjustments | 15 ❤️ | 150,000 |

This table is a forecast illustration, not a guaranteed Google settlement calculation.

---

## 7. Gift transaction lifecycle

### 7.1 Business event sequence

The required business sequence is:

```text
created
→ completed
→ pending_creator_reward
→ creator_reward_available
→ paid
```

Error and exception outcomes:

```text
failed
cancelled
reversed
refunded
fraud_hold
```

### 7.2 Do not overload one database status

The sequence above spans two accounting objects. V1 must store separate states:

**Gift transaction state**

```text
created
completed
failed
cancelled
fraud_hold
refunded
reversed
```

**Creator reward state**

```text
pending
available
held
paid
reversed
```

A `completed` gift creates a `pending` Creator reward. The reward later becomes `available`, may move to `held`, may become `paid`, or may be `reversed`.

### 7.3 Valid gift transitions

| Current | Allowed next state | Rule |
|---|---|---|
| created | completed | Atomic debit and transaction creation succeeded |
| created | failed | Validation or database operation failed |
| created | cancelled | User cancelled before completion and no value moved |
| completed | fraud_hold | Risk rule requires investigation |
| completed | refunded | Linked purchase/gift value was refunded under approved process |
| completed | reversed | Administrative or system reversal with immutable entries and reason |
| fraud_hold | completed | Review cleared; no duplicate debit/reward is created |
| fraud_hold | refunded/reversed | Review confirms refund, fraud or invalid transaction |

Terminal states are not edited back into another meaning. A correction requires a new event and ledger entries.

### 7.4 Atomic gift operation

The server-side gift command must execute in one PostgreSQL transaction:

```text
validate authenticated sender
validate recipient and Creator eligibility for reward
validate friendship/chat context where applicable
validate gift catalog and quantity
validate daily limits and risk controls
lock/read spendable heart balance
calculate gross, Creator and platform units using config snapshot
debit sender heart ledger
create gift transaction with price and split snapshots
create pending Creator reward ledger entry
create gift message/event if requested
update Fan progress from eligible net support
write audit/event references
commit
```

If any step fails, the entire database transaction rolls back.

### 7.5 Required controls

- Client-generated `idempotency_key`, unique per sender command.
- Server-generated transaction identifier.
- Server-authoritative price and split.
- Positive integer quantity within configured bounds.
- No self-gifting unless a later documented rule explicitly permits it; V1 default is prohibited.
- No gift to blocked, suspended or deleted accounts.
- No negative spendable balance created by normal gifting.
- Duplicate requests return the original result.
- All gift transaction references are traceable to sender debit and Creator reward entries.

---

## 8. Ledger principles

### 8.1 Immutable ledgers

The financial source of truth consists of append-only records. At minimum, later schema phases must support:

```text
heart_ledger
creator_reward_ledger
purchase records
gift_transactions
withdrawal records
financial audit logs
```

Existing ledger entries must never be updated to change their economic meaning or deleted to hide history.

### 8.2 Adjustments

Every correction is a new entry with:

```text
entry_type
amount_units
reference_type
reference_id
reason_code
human_reason
idempotency_key
created_by
created_at
```

Examples:

```text
purchase_credit
gift_debit
purchase_refund_debit
refund_debt
admin_credit_adjustment
admin_debit_adjustment
creator_reward_pending
creator_reward_available
creator_reward_hold
creator_reward_release
creator_reward_paid
creator_reward_reversal
creator_recovery
```

### 8.3 Reference integrity

Every financial entry must reference its originating object where applicable:

- Purchase credit → Play purchase.
- Gift debit → Gift transaction.
- Creator reward → Gift transaction.
- Refund debit/reversal → Refund/revocation event and original purchase.
- Payout entry → Withdrawal.
- Admin adjustment → Admin action and approved reason.

### 8.4 Idempotency

Idempotency keys are required for:

- Purchase verification and credit.
- Gift submission.
- Refund/revocation event processing.
- Pending-to-available reward release jobs.
- Reward hold/release.
- Withdrawal submission.
- Withdrawal approval and paid confirmation.
- Admin adjustments.

Idempotency uniqueness must be enforced by the database, not only by application code.

### 8.5 Admin restrictions

Administrators must not edit a balance field directly. An authorized Admin may request an adjustment only through a controlled command that:

1. Requires a reason code and explanation.
2. Creates balancing ledger entries.
3. Records actor, timestamp and before/after derived balances.
4. Is protected by role-based authorization.
5. Is included in immutable audit logs.
6. Requires dual approval above a configurable risk threshold in a later control phase.

---

## 9. Creator earning lifecycle

### 9.1 State machine

Normal lifecycle:

```text
pending
→ available
→ held
→ available
→ paid
```

Direct normal payout is also allowed:

```text
pending
→ available
→ paid
```

Reversal lifecycle:

```text
pending
→ reversed
```

or:

```text
available
→ held
→ reversed
```

If already paid:

```text
paid
→ creator_recovery entry
```

The historical `paid` entry remains unchanged; recovery is recorded as a new obligation and may offset future available earnings subject to policy and legal review.

### 9.2 Pending hold period

Recommended V1 range:

```text
7–14 days
```

Initial conservative default:

```text
creator_reward_hold_days = 14
```

The value must live in `app_config`, be versioned and be snapshotted or otherwise auditable for each reward cohort. It must not be hard-coded in mobile or Edge Function code.

The release job moves only eligible rewards whose `available_at` has passed and that are not subject to:

- Purchase refund/revocation.
- Gift reversal.
- Creator account suspension.
- KYC or fraud review hold.
- Chargeback/refund risk signal.
- Legal or compliance hold.

### 9.3 Balance rules

- `pending` cannot be withdrawn.
- `available` can be requested for withdrawal if all conditions pass.
- `held` cannot be withdrawn.
- `paid` is historical and cannot be changed in place.
- `reversed` remains visible in history.
- Future available rewards may be offset by a documented `creator_recovery` obligation.

---

## 10. Refund, revocation and reversal rules

### 10.1 General principles

1. Refund and revocation events are verified server-side.
2. Processing is idempotent.
3. Original records remain unchanged.
4. New debit, reversal, hold or recovery entries explain the correction.
5. The system attempts to identify the heart units originating from the refunded purchase.
6. V1 should use a deterministic consumption allocation method, recommended FIFO purchase lots, so used and unused units can be traced.
7. Refund handling must not silently create spendable negative hearts or erase Creator history.
8. All outcomes produce an audit trail and user/admin-visible status appropriate to the context.

### 10.2 Google refund before credited hearts are used

```text
purchase credited
→ refund/revocation verified
→ debit remaining units from the linked purchase lot
→ mark purchase refunded/revoked
→ no Creator reward affected
```

If the full credited amount remains unused, the user's spendable balance decreases by the full refunded units and cannot go below zero from this case.

### 10.3 Google refund after some or all hearts are used

Processing order:

1. Debit any unused units remaining in the refunded purchase lot.
2. Calculate `unrecovered_units` for units already consumed.
3. Identify linked gift transactions using deterministic lot allocation.
4. Put affected transactions and rewards into review or reversal processing.
5. Create a non-spendable `heart_debt`/refund-debt ledger entry for any unrecovered user liability.
6. Block further gifting while refund debt is positive; risk controls may also suspend purchases or the account.
7. Do not mutate the original gift debit or purchase credit.

The spendable balance exposed to the user is never negative:

```text
heart_balance_spendable_units = max(0, net_heart_units_without_debt)
```

Debt is tracked separately for risk and recovery.

### 10.4 Creator reward still pending

```text
pending reward
→ creator_reward_reversal entry
→ reward state reversed
```

No withdrawal impact exists because pending value was never withdrawable.

### 10.5 Creator reward already available

```text
available reward
→ creator_reward_hold entry
→ investigation / deterministic refund allocation
→ creator_reward_reversal entry
```

If the Creator has sufficient available units, the reversal is applied without creating an unrecovered obligation. If insufficient, the remaining amount becomes `creator_recovery_units` and blocks or offsets future withdrawals.

### 10.6 Creator reward already held

The held amount is not released. It is either:

- Reversed after the refund/fraud decision; or
- Released back to available if the event is resolved as valid.

Both outcomes require new ledger entries and an audit reference.

### 10.7 Creator reward already paid

A paid record is never edited or deleted.

The system creates:

```text
creator_recovery_units
risk_case
linked refund/revocation reference
```

Future withdrawals are blocked or reduced until the recovery obligation is resolved. Manual collection or legal action is an operations decision outside the automated V1 flow.

### 10.8 Fraud hold

A `fraud_hold` may apply to:

- Play purchase.
- Gift transaction.
- User heart balance.
- Creator reward.
- Withdrawal request.
- Account.

A hold requires a reason code, actor/system source, start time and resolution. Releasing a hold does not create duplicate credits or rewards.

### 10.9 User and Creator notifications

Notifications must be clear but must not disclose internal fraud models. They should state:

- What transaction was affected.
- Whether ❤️ or Creator earnings changed.
- Current status.
- Whether gifting or withdrawal is temporarily restricted.
- How to contact support or appeal where applicable.

---

## 11. KYC, bank account and withdrawal

### 11.1 Eligibility conditions

A withdrawal request is accepted only when all conditions are true:

- Account holder is an approved Creator.
- Creator is at least 18 years old.
- Creator Terms version has been accepted.
- KYC status is `approved`.
- Bank account status is `approved` and belongs to or is legally permitted for the verified Creator.
- Account is active and not suspended, deleted or payout-blocked.
- No active fraud, legal or compliance hold applies.
- `creator_available_units` is sufficient.
- Requested amount is at least the configured minimum.
- Requested amount does not exceed the available balance or configured limits.
- No unresolved Creator recovery obligation prevents payout.
- Admin approves the request manually.

### 11.2 Default minimum

```text
minimum_withdrawal_units = 1000
1000 units = 10 ❤️ = 100,000 VNĐ
```

The threshold is stored in `app_config` and may be changed prospectively. Existing withdrawal requests retain the configuration snapshot applicable when submitted.

### 11.3 Withdrawal amount calculation

```text
amount_vnd = reward_units * heart_vnd_rate / HEART_UNITS_PER_HEART
```

With V1 defaults:

```text
1000 units * 10000 / 100 = 100,000 VNĐ
```

The calculation must result in an integer VNĐ amount. Statutory tax withholding or banking fees, if applicable, must be represented as separate fields and disclosed; they must not be hidden by modifying the Creator reward units.

### 11.4 Withdrawal state model

Recommended states:

```text
requested
under_review
approved
processing
paid
rejected
cancelled
failed
fraud_hold
```

Normal flow:

```text
requested
→ under_review
→ approved
→ processing
→ paid
```

Exception flows:

```text
requested/under_review → rejected
requested/under_review → cancelled
approved/processing → failed
any non-terminal state → fraud_hold
fraud_hold → under_review/rejected/approved
```

### 11.5 Reservation and payment rules

1. On submission, requested units are atomically moved from available to held/reserved for that withdrawal.
2. Rejected, cancelled or failed requests release eligible reserved units through a new ledger entry.
3. Marking a withdrawal `paid` requires an Admin payment reference and paid timestamp.
4. Admin cannot mark `paid` without an approved request and sufficient reserved units.
5. Manual bank transfer in V1 occurs outside the user app; the result and reference are recorded by an authorized Admin.
6. High-value payouts should require dual control when the Admin module is implemented.
7. Bank details and KYC data are sensitive, private and excluded from analytics and normal logs.

---

## 12. Fan logic and safe Fan Album

### 12.1 Fan qualification

In V1, Fan progress for a user–Creator pair is based on net eligible support:

```text
fan_support_units = completed eligible gift units
                    - refunded gift units
                    - reversed gift units
```

Rules:

- The Creator may select a Fan threshold within system-defined minimum and maximum bounds.
- Initial proposed minimum is `fan_minimum_units = 1000` (10 ❤️).
- The configured threshold is displayed in ❤️ only.
- Progress is calculated per supporter and per Creator.
- Self-gifts, failed gifts, cancelled gifts, refunded gifts, reversed gifts and fraudulent gifts do not count.
- Fan status is a community benefit, not a financial, romantic, sexual or meeting obligation.

### 12.2 Unlock and access

```text
fan_support_units >= creator_fan_threshold_units
→ Fan membership active
→ approved Fan Album content may be viewed
```

If a refund or reversal reduces net eligible support below the threshold, Fan access is relocked after the verified financial event. The user receives a neutral transaction-status explanation. A future grace-period policy, if introduced, must be explicit and configurable.

### 12.3 Creator threshold controls

A Creator cannot:

- Set a threshold below the system minimum.
- Set a threshold above a system maximum defined for abuse prevention.
- Create different hidden thresholds for individual users.
- Require a specific gift that implies a meeting, relationship, sexual content or off-platform access.
- Override refunds or manually grant paid access in exchange for external payment.

Admin may suspend or reset a threshold when it violates policy, with an audit record.

### 12.4 Fan Album safety

- Every Fan Album upload starts as `pending_review` and is inaccessible to Fans until approved.
- Fan Album content follows the same or stricter standard as public profile media.
- Nudity, sexually explicit or sexually suggestive content, sexual services and gift-for-content arrangements are prohibited.
- Fan Album storage must be private and served through short-lived authorized access.
- Users can report Album content and block the Creator.
- Moderation removal immediately revokes access to the affected item.
- A Fan threshold never guarantees content quantity, direct replies, meetings or private contact.

---

## 13. Business configuration

### 13.1 Configuration principles

- Runtime business values live in a server-controlled `app_config` system.
- Mobile clients may read safe public configuration but cannot authoritatively set it.
- Secret or risk-only configuration is server/Admin-only.
- Every change is versioned, timestamped and audited.
- Financial transactions store relevant configuration snapshots.
- Changes apply prospectively unless a documented reconciliation explicitly states otherwise.

### 13.2 Required configuration keys

| Key | Type | V1 default/proposal | Scope and rule |
|---|---|---:|---|
| `heart_vnd_rate` | integer VNĐ per ❤️ | `10000` | Used for approved purchase/withdrawal displays and Creator payout conversion; snapshot per transaction |
| `creator_share_bps` | integer bps | `7000` | Creator gross reward share |
| `platform_share_bps` | integer bps | `3000` | Platform gross share; sum with Creator share must equal 10,000 |
| `estimated_google_fee_bps` | integer bps | `1500` | Forecast only; actual settlement stored separately |
| `creator_reward_hold_days` | integer days | `14` | Must remain configurable; approved range initially 7–14 days |
| `minimum_withdrawal_units` | integer heart units | `1000` | 10 ❤️ / 100,000 VNĐ at V1 rate |
| `maximum_daily_gift_units` | integer heart units | **TBD before financial beta** | Risk limit per sender; server-only enforcement |
| `maximum_daily_purchase_units` | integer heart units | **TBD before Play Billing beta** | Risk limit per purchaser; server-only enforcement |
| `fan_minimum_units` | integer heart units | `1000` | Lowest Creator-selectable Fan threshold |
| `location_fuzz_radius_meters` | integer meters | **TBD in discovery design** | Server-side privacy configuration; no exact coordinates exposed |
| `account_deletion_grace_days` | integer days | **TBD with privacy/legal review** | Prospective deletion workflow value; lawful financial retention remains separate |

Recommended additional keys:

| Key | Type | Purpose |
|---|---|---|
| `fan_maximum_units` | integer units | Prevent abusive or misleading Fan thresholds |
| `maximum_gift_quantity_per_command` | integer | Prevent accidental or automated bulk gifting |
| `withdrawal_daily_limit_units` | integer units | Payout risk control |
| `withdrawal_manual_dual_control_units` | integer units | Threshold requiring two authorized reviewers |
| `creator_reward_hold_days_high_risk` | integer days | Longer hold for risk cohorts where legally and contractually allowed |
| `refund_debt_blocks_gifting` | boolean | Default `true` |
| `creator_recovery_blocks_withdrawal` | boolean | Default `true` |

### 13.3 Values that are not normal runtime configuration

The following are protocol/accounting invariants and must not be casually changed through Admin UI:

```text
HEART_UNITS_PER_HEART = 100
BASIS_POINTS_DENOMINATOR = 10000
ledger immutability
idempotency requirements
separation of heart balance and Creator earnings
```

---

## 14. Permissions and audit ownership

| Action | Authorized actor | Mandatory evidence |
|---|---|---|
| Verify Play purchase | Server/Edge Function | Token hash/reference, product, verification result, idempotency key |
| Credit ❤️ | Server transaction | Purchase reference and ledger entry |
| Send gift | Authenticated user through server command | Sender, recipient, catalog snapshot, config snapshot, idempotency key |
| Release pending reward | Scheduled server job | Reward cohort, eligibility result, idempotency key |
| Hold/reverse reward | Risk system or authorized Admin | Reason code, case reference, actor |
| Submit withdrawal | Eligible Creator | Amount, accepted terms/config snapshot, idempotency key |
| Approve/reject withdrawal | Authorized Admin | Decision, reason, actor, timestamp |
| Mark withdrawal paid | Authorized Finance/Admin role | Payment reference, amount, timestamp; dual control when required |
| Adjust balance | Restricted Finance/Admin command | Paired ledger adjustment, reason, approval and audit log |
| Change business configuration | Authorized Admin role | Old/new value, effective time, actor, approval |

Admin authorization must be derived from trusted server-side authorization data, not a user-editable profile field.

---

## 15. Accounting and reconciliation invariants

The implementation and tests must preserve:

```text
sum(heart purchase credits)
+ sum(approved heart adjustments)
- sum(gift debits)
- sum(refund/revocation debits)
= derived net heart position
```

For each completed gift:

```text
gross_heart_units
= creator_reward_units + platform_gross_units
```

For each Creator:

```text
pending + available + held + paid + reversed/recovery movements
must reconcile to Creator reward ledger entries
```

For each withdrawal:

```text
requested_units
= reserved_units
= paid_units or released/rejected units
```

No financial record is considered complete unless purchase, gift, reward, refund and withdrawal references can be traced end-to-end.

---

## 16. Required test scenarios for later implementation

Session 2 is documentation-only; automated tests will be implemented in later phases. The following cases are mandatory test inputs:

1. Convert 1, 10 and 100 ❤️ into heart units and VNĐ without float arithmetic.
2. Split every V1 gift price at 70/30 and prove gross equals Creator plus platform units.
3. Reject a split configuration not totaling 10,000 bps.
4. Credit a valid Play purchase exactly once despite repeated callbacks.
5. Reject a duplicated purchase token.
6. Send a gift exactly once despite duplicate network submissions.
7. Roll back the entire gift transaction when reward creation fails.
8. Prevent gifting when spendable balance is insufficient.
9. Prevent withdrawal of purchased heart balance.
10. Move Creator reward from pending to available only after configured hold and no active hold.
11. Reverse a pending reward after refund.
12. Hold and reverse an available reward after refund.
13. Create Creator recovery when an already-paid reward is affected.
14. Create refund debt when refunded hearts were already spent.
15. Block gifting while refund debt is positive.
16. Block withdrawal while Creator recovery is unresolved.
17. Reserve available earnings atomically when withdrawal is requested.
18. Release reserved earnings after withdrawal rejection/failure.
19. Mark withdrawal paid only with an approved request and payment reference.
20. Unlock Fan Album at threshold and relock after verified refund drops net support below threshold.
21. Exclude failed, cancelled, refunded, reversed and fraudulent gifts from Fan progress.
22. Ensure VNĐ is absent from all Social surfaces.
23. Ensure Admin adjustments create ledger and audit entries rather than editing balances.

---

## 17. Acceptance criteria verification

- [x] `1 ❤️ = 10,000 VNĐ = 100 heart_units` is defined.
- [x] All calculations use integer heart units; float arithmetic is prohibited.
- [x] Seven Google Play heart packages are defined.
- [x] Twenty internal gift price points from 1–100 ❤️ are defined.
- [x] Creator reward is 70% and platform gross share is 30% using basis points.
- [x] Estimated Google fee is configurable and not hard-coded into Creator reward logic.
- [x] Purchased heart balance and Creator earnings are separate assets and ledgers.
- [x] Gift and Creator reward state machines are documented separately.
- [x] Immutable ledger, reference, idempotency and audit requirements are defined.
- [x] Pending, available, held, paid and reversed Creator earning states are defined.
- [x] Configurable 7–14 day hold is defined with a proposed 14-day default.
- [x] KYC, bank approval, withdrawal eligibility and manual Admin approval are defined.
- [x] Minimum withdrawal defaults to 10 ❤️ / 100,000 VNĐ and is configurable.
- [x] Refund logic covers unused, spent, pending, available, held and paid cases.
- [x] Negative/refund debt and Creator recovery handling are defined.
- [x] Fan qualification uses net eligible support and Fan Album remains moderated and non-adult.
- [x] Required business configuration keys are listed and versioning rules are defined.
- [x] No Admin may directly edit a balance.

---

## 18. Session 2 completion record

### Completed

- Defined the integer heart currency and display rules.
- Defined Play Billing heart products and the internal 20-gift catalog.
- Defined 70/30 split, fee treatment and accounting snapshots.
- Separated purchased heart balance from Creator earnings.
- Defined gift, reward, refund, Fan and withdrawal state machines.
- Defined immutable ledger, idempotency, audit and Admin-control rules.
- Defined configurable hold, withdrawal minimum and business configuration matrix.
- Defined mandatory future test scenarios.

### Files created or modified

```text
docs/phase-a/02-business-rules.md
```

### Validation performed

- Documentation structure reviewed against Session 2 requirements.
- Integer examples manually reconciled.
- Creator/platform split checked to total 10,000 bps.
- Required package and gift counts checked: 7 heart packages, 20 gift price points.
- No code, database schema, Supabase data or production environment was changed in this session.

### Known limitations / deferred implementation

- Automated tests are deferred until domain and database packages exist.
- Actual Play Console product IDs and localized prices are not yet created.
- Maximum purchase/gift/withdrawal limits require risk approval before financial beta.
- Tax withholding and bank-fee rules require Vietnamese legal/accounting confirmation.
- Database tables, RLS, Edge Functions and refund webhook processing belong to later phases.

---

**Decision:** These rules are the source of truth for MyFan V1 financial domain design. Any UI, code, database schema, Admin action or marketing copy that conflicts with the separation of purchased ❤️ and Creator earnings, the 70/30 split, immutable ledgers, safe Fan logic or refund controls must be corrected before release.
