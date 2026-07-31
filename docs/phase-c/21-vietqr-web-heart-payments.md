# Phase C — Session 21: VietQR mobile-web heart payments

## Scope

Session 21 adds authenticated mobile-web purchase orders for the seven existing heart products. Android native does not expose bank-transfer checkout; its future digital-goods path remains Google Play Billing.

Existing products are reused without inventing a second catalog:

| Package | Amount |
|---:|---:|
| 5 ❤️ | 250,000 VND |
| 10 ❤️ | 500,000 VND |
| 20 ❤️ | 1,000,000 VND |
| 50 ❤️ | 2,500,000 VND |
| 100 ❤️ | 5,000,000 VND |
| 200 ❤️ | 10,000,000 VND |
| 500 ❤️ | 25,000,000 VND |

The fixed product rule remains `1 ❤️ = 50,000 VND` and `1 ❤️ = 100 integer heart units`.

## Receiving account

Each order snapshots the configured receiving account so historical orders are not rewritten by a later configuration change.

```text
Bank: Vietcombank
Bank code: VCB
Bank BIN: 970436
Account: 0011004000713
Beneficiary: Tieu Vo Dinh Phi
QR beneficiary text: TIEU VO DINH PHI
```

The account configuration is stored in private `app_config` and is returned only inside an authenticated user's own order RPC.

## Checkout flow

1. The signed-in adult opens the Balance tab on Expo mobile web.
2. The user chooses one of the existing heart products.
3. `create_vietqr_heart_order` snapshots product, price and receiving-account fields.
4. Server creates a unique order code and transfer content such as `MYFANMFQ...`.
5. The client renders the VietQR Quick Link image with exact amount and transfer content.
6. The user may copy account, amount and transfer content.
7. “Tôi đã chuyển khoản” changes the order only to `awaiting_confirmation`.
8. The client polls its own order every ten seconds.
9. A trusted reconciliation service calls the service-role-only settlement RPC.
10. Only exact-amount settlement creates a normal FIFO heart lot and immutable ledger credit.

The client cannot mark an order paid and cannot grant hearts.

## Expiry

Orders expire after 30 minutes by default. The server refreshes expired state before every owner operation. A trusted reconciliation service may still settle an expired order if a matching bank transaction arrives late; cancelled or rejected orders are not automatically settleable.

## Database

Migration:

```text
20260731090337_phase_c_21_vietqr_web_heart_payments.sql
```

Objects:

```text
private.vietqr_payment_state
private.vietqr_payment_orders
```

Existing `private.play_purchases` gains a provider discriminator and provider references so the existing heart-lot, FIFO gifting, reversal and immutable ledger machinery can be reused without a parallel balance engine.

## RPC grants

Authenticated and service role:

```text
list_vietqr_heart_products
create_vietqr_heart_order
get_my_vietqr_heart_order
mark_my_vietqr_transfer_submitted
cancel_my_vietqr_heart_order
```

Service role only:

```text
record_verified_vietqr_payment
```

`anon` has no access. App roles have no direct table grants on `private.vietqr_payment_orders`.

## Settlement guarantees

`record_verified_vietqr_payment`:

- locks the order;
- validates exact VND amount;
- rejects duplicate bank transaction references;
- creates one provider-aware purchase record;
- creates one FIFO heart lot;
- updates the private heart account;
- writes one immutable `purchase_credit` ledger entry;
- advances the public economy version signal;
- marks the order paid;
- returns the existing result on retries after payment.

No screenshot, client button or QR render can credit hearts.

## Mobile web UI

Routes:

```text
/(tabs)/balance
/payments/vietqr
```

The checkout screen includes:

- seven package choices;
- exact VND amount;
- dynamically loaded VietQR image;
- bank/account/beneficiary snapshot;
- copy actions;
- unique transfer content;
- 30-minute countdown;
- owner status polling;
- submitted, paid, expired, cancelled and rejected states;
- explicit warning that client confirmation does not credit hearts.

Native Android renders an explanatory blocked state instead of bank-transfer checkout.

## External-service boundary

VietQR Quick Link generates the payment instruction image. It does not prove funds arrived. Automatic confirmation still requires a trusted bank feed, payOS/Casso integration or a manual server-side reconciliation process. That integration must never expose its secret or service-role credentials to the browser.

## Verification state

Database verification confirms:

- seven active products map to exact amounts;
- migration ledger entry exists;
- receiving account and expiry settings exist in private config;
- no direct client table grants;
- client RPCs exclude `anon`;
- settlement RPC is service-role-only;
- provider columns exist on the canonical purchase table;
- development database currently contains zero VietQR orders.

## Remaining QA

- authenticated test account order creation;
- scanning with VCB Digibank and other supported bank apps;
- exact amount/content display on real devices;
- late and expired transfer reconciliation;
- duplicate bank reference handling;
- webhook/manual reconciliation implementation;
- refund/reversal policy for bank transfers;
- mobile widths and clipboard behavior;
- Netlify preview and real environment configuration.
