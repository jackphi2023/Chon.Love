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
→ server creates one idempotent receiving-account snapshot for that membership order
→ app displays trusted img.vietqr.io QR + exact amount + unique transfer content
→ member transfers and taps “Tôi đã chuyển khoản”
→ mark_my_luxy_membership_order_submitted(order_id)
→ status = awaiting_confirmation
→ Admin performs exact bank reconciliation and LX-17 approval
→ membership activates; Diamond heart credit is posted atomically by LX-17
```

The checkout view polls every 10 seconds so an Admin approval can be reflected without client-side activation logic.

## 4. VietQR security and accounting boundaries

LX-18 reuses the existing VietQR receiving-account configuration instead of duplicating bank data or using the heart-topup order table.

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

## 8. Known inherited build blocker

At LX-18 implementation time, the repository's full Expo Web build has a pre-existing invalid raster badge asset problem under `apps/mobile/assets/luxy/*-badge.png`. Lint, TypeScript and unit checks are independent from this asset issue. LX-18 does not replace founder-provided Premium/Diamond artwork with a fake text badge just to bypass Metro.
