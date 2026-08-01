# BR-07 — VietQR Reconciliation MVP

BR-07 adds a finance-operations reconciliation layer around the existing VietQR order model. It does not re-enable VietQR heart purchases for Android, expose an automatic bank webhook, or enable any financial feature for Beta users.

## Objective

The MVP separates four actions that were previously too close together:

1. receive or manually import a bank transaction record;
2. normalize and match its transfer content to a VietQR order;
3. route mismatches and missing tokens to a review inbox;
4. credit hearts only after an explicit, role-checked, audited settlement decision.

Importing a bank row never credits hearts.

## Data model

BR-07 adds two private, client-inaccessible tables:

- `private.vietqr_bank_transactions`: one canonical row per provider transaction reference;
- `private.vietqr_reconciliation_events`: immutable event history for import, duplicate import, match, settlement, ignore, and rejection.

Reconciliation states are:

- `unmatched`
- `matched`
- `needs_review`
- `settled`
- `ignored`
- `rejected`

## Matching rules

Transfer content is uppercased and reduced to alphanumeric characters. The matcher extracts only a token in the existing format:

```text
MYFANMFQ + 12 hexadecimal characters
```

Classification is deterministic:

- valid token + existing order + exact amount + unpaid order → `matched`;
- valid token but amount mismatch or already-paid order → `needs_review`;
- missing or unknown token → `unmatched`.

No fuzzy name, account, amount, or timestamp matching is used in the MVP.

## Security boundary

All privileged operations require `finance_admin` or `super_admin` at the database layer. The browser calls a JWT-protected Edge Function using the normal public Supabase client. The Edge Function validates the user token and uses the service-role key only server-side.

The migration revokes:

- authenticated access to the old VietQR order/product/status RPCs;
- service-role access to the direct heart-credit RPC;
- all client table access to reconciliation records.

Settlement is reachable only through the audited finance decision RPC.

## Disabled-by-default controls

BR-07 sets all of these database flags to `false`:

- `vietqr_reconciliation_enabled`
- `vietqr_manual_settlement_enabled`
- `vietqr_auto_settlement_enabled`
- `vietqr_web_payments_enabled`

This means schema, UI, tests, and audit controls can be reviewed without allowing users to create VietQR heart orders or allowing admins to credit hearts in the hosted Beta environment.

## Admin MVP

The Admin page provides:

- manual transaction import;
- status filters and queue summary;
- exact-order manual linking;
- explicit settlement action;
- ignore/reject actions requiring audit reason codes.

The page does not store a service-role key and does not offer bulk automatic settlement.

## Explicit exclusions

BR-07 does not include:

- Android in-app VietQR checkout;
- automatic heart credit from bank callbacks;
- public webhook ingestion;
- CSV file upload or scheduled bank polling;
- refunds or chargeback automation;
- production deployment;
- merge authorization;
- financial feature enablement.
