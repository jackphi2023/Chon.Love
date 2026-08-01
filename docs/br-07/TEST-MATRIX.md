# BR-07 Test Matrix

| Area | Scenario | Expected result |
|---|---|---|
| Configuration | Clean migration reset | Reconciliation, manual settlement, automatic settlement, and web VietQR order flags are all `false` |
| Authorization | Normal authenticated user imports a bank row | Rejected with `required_admin_role_missing` |
| Authorization | `finance_admin` or `super_admin` imports or reviews | Allowed through service-side RPC path |
| API exposure | Authenticated client calls legacy VietQR order RPC | Execute privilege denied |
| API exposure | Service role calls direct heart-credit RPC | Execute privilege denied |
| Isolation | Client reads private reconciliation tables | No schema usage, no table grants, RLS deny policy |
| Import | Exact provider/ref imported twice | One transaction row; duplicate import recorded and returned idempotently |
| Import | Same request ID retried | Same transaction result; no duplicate financial action |
| Matching | Exact token and exact amount | `matched` |
| Matching | Token exists but amount differs | `needs_review` |
| Matching | Token missing or unknown | `unmatched` |
| Manual match | Finance links exact-amount order | Transaction becomes `matched`; no heart credit |
| Settlement flag | Finance settles while disabled | Fails closed with `vietqr_manual_settlement_disabled` |
| Settlement | Exact reviewed match after explicit local test enablement | One purchase, one lot, one ledger credit, order `paid`, transaction `settled` |
| Settlement retry | Same request ID repeated | Idempotent result; no second heart credit |
| Final actions | Ignore unmatched row with reason | `ignored`; no heart credit; audit event written |
| Final actions | Reject mismatch with reason | `rejected`; no heart credit; audit event written |
| Audit | Update reconciliation event | Rejected |
| Audit | Delete reconciliation event | Rejected |
| Application | Shared Zod contract and Admin build | Typecheck, unit tests, and build pass |
| Regression | BR-01 through BR-06 tests | All existing security, social, Creator, browser, and Storage contracts remain green |
| Financial safety | Gift, withdrawal, Billing, VietQR auto settlement | Not executed or enabled by BR-07 |

All database fixtures run inside a transaction and end with `ROLLBACK`.
