# LX-18 — Upgrade/Billing + VietQR Web

**Branch:** `agent/lx-18-upgrade-billing-vietqr`  
**Stacked on:** `agent/lx-17-premium-diamond-engine`  
**Reference:** Seeking Upgrade/Billing screenshots + `LX-00-UI-FIDELITY-SPEC.md`  
**Scope:** Pricing selection, compare table, web VietQR checkout, caller billing history, LX-17 membership-order integration.

## 1. Product contract

LX-18 does not introduce another membership source of truth. It consumes the LX-17 server contract:

- Premium: 1,000,000 VND / period.
- Diamond: 5,000,000 VND / period.
- Periods: 1 or 3 only.
- 3 periods: 20% discount.
- Diamond: 80% of the actually approved membership payment is credited to the existing heart ledger by the LX-17 Admin approval transaction.
- Member-created checkout never activates a paid tier.
- Member marking a bank transfer only moves the membership order from `awaiting_payment` to `awaiting_confirmation`.
- Finance Admin / Super Admin approval remains the only activation path.
- Membership expiry continues to be enforced by LX-17.

## 2. Seeking fidelity mapping

The Billing route intentionally follows the frozen Seeking-derived contract:

- centered narrow billing column (max ~600 px);
- Luxy.Love brand centered at top with back affordance on the left;
- tabs `Gói thành viên` / `Một lần`;
- Premium before Diamond;
- 1-period and 3-period bordered options rather than generic marketing cards;
- selected option = accent border + very light accent surface;
- Diamond uses an ink `ULTIMATE ACCESS` badge;
- no gold/neon/gradient pricing treatment;
- compare table below pricing;
- payment detail uses a narrow modal capped at 466 px, matching the Upgrade-detail reference footprint.

The `Một lần` tab is deliberately not populated with invented products. One-time gift commerce belongs to LX-19.

## 3. Web checkout flow

```text
Member opens Nâng cấp
→ app reads server plan options
→ member selects Premium/Diamond + 1/3 periods
→ create_luxy_membership_order(..., source='upgrade_billing_web')
→ get_my_luxy_membership_checkout(order_id)
→ server creates one receiving-account snapshot for that membership order
→ app displays trusted img.vietqr.io QR + exact amount + unique transfer content
→ member transfers and taps “Tôi đã chuyển khoản”
→ mark_my_luxy_membership_order_submitted(order_id)
→ status = awaiting_confirmation
→ Admin performs exact-payment bank review and LX-17 approval
→ membership activates; Diamond heart credit is posted atomically by LX-17
```

The checkout view polls every 10 seconds so an Admin approval can be reflected without client-side activation logic.

## 4. VietQR security and accounting boundaries

LX-18 reuses the existing VietQR receiving-account configuration instead of duplicating bank data or using the heart-topup order table.

Membership web checkout uses its own explicit product gate, `luxy_membership_vietqr_web_enabled`. This is intentionally separate from BR-07's legacy `vietqr_web_payments_enabled`, which remains the gate for the older heart-topup flow. Therefore LX-18 does not accidentally reopen generic heart topups when membership checkout is enabled.

`private.luxy_membership_checkout_snapshots` snapshots only safe receiving details and transfer content for the caller-owned membership order. Authenticated clients receive these details only through `get_my_luxy_membership_checkout(uuid)` and retain no direct `private` schema/table access.

QR URLs are accepted by the shared client only when HTTPS and host is exactly `img.vietqr.io`.

The membership order amount is the LX-17 server snapshot. The client does not calculate an amount that can be submitted to Admin as authoritative payment data.

## 5. Platform boundary

- Web desktop / mobile web / PWA: LX-18 exposes VietQR checkout.
- Native Android: the VietQR CTA is disabled; Google Play Billing remains LX-21.
- No Android external-payment bypass is introduced by LX-18.

## 6. UI additions

`apps/mobile/app/settings/membership.tsx` now includes:

- current membership tier / expiry;
- authoritative pricing selector;
- 3-period discount state;
- Diamond heart-credit preview;
- feature comparison table;
- recent member-owned billing requests;
- reopenable checkout modal;
- exact bank/amount/content copy affordances;
- pending / approved / rejected / cancelled states;
- existing Premium/Diamond privacy controls.

The authenticated shell already routes `Nâng cấp` to `/settings/membership`, so LX-18 is reachable from the primary Seeking-style navigation on desktop, tablet and phone.

## 7. Contract coverage

`packages/supabase/src/membership.test.ts` covers pricing, Diamond 80% credit preview, checkout parsing, trusted VietQR host and caller billing history.

`supabase/tests/lx_18_upgrade_billing_vietqr.sql` covers:

- direct private-table denial;
- exact Diamond 3-period amount;
- exact 192-heart preview;
- unique Luxy transfer content;
- trusted VietQR host;
- configured receiving bank snapshot;
- caller-owned billing history;
- member submission stops at `awaiting_confirmation`;
- self-submission does not activate membership;
- checkout snapshot idempotency;
- cross-user checkout isolation.

The dedicated LX-18 workflow passes the membership unit contract, mobile TypeScript contract, clean local database reset, LX-17 regression, LX-18 pgTAP contract and database lint.

## 8. Build gate repair

The inherited Premium/Diamond badge files on the stacked LX-17 branch were malformed raster payloads even though they used `.png` names, which caused Expo Web/Metro to fail with `unsupported file type`.

LX-18 restores both assets as valid transparent PNG files derived from the founder-provided Premium and Diamond artwork. This keeps the real membership badges instead of replacing them with placeholder text. After the repair, the repository's full CI passes workspace validation, lint, TypeScript, all unit tests, admin/public web builds and Expo Web export.
