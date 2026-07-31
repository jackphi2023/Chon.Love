# BR-07 Status

- Status: implementation in progress; CI validation pending
- Head branch: `agent/br-07-vietqr-reconciliation-mvp`
- Base branch: `agent/br-06-mobile-web-browser-e2e`
- Base SHA: `28576e5e90980758f341ae386f3614fd2dbb5642`
- Draft pull request: pending
- Provisional migration: `20260801010100_br_07_vietqr_reconciliation_mvp`
- Expected local migration count: 79
- Reconciliation feature flag: disabled
- Manual settlement feature flag: disabled
- Automatic settlement feature flag: disabled
- VietQR web order feature flag: disabled
- Direct client VietQR heart-order RPCs: revoked by migration
- Direct service-role heart-credit RPC: revoked by migration
- Admin roles: `finance_admin`, `super_admin`
- Public bank webhook: none
- Hosted reconciliation records: none expected
- Controlled Beta users used: none
- Controlled Beta credentials read, stored, or modified: none
- Financial release flag: disabled
- Merge: not authorized
- Production deployment: not authorized

## Implementation summary

BR-07 introduces a private bank-transaction inbox, deterministic token matching, immutable reconciliation events, finance-only import/review RPCs, a JWT-protected Edge Function, shared TypeScript contracts, and an Admin reconciliation page.

Import, match, settlement, ignore, and reject are separate operations. Import and matching do not credit hearts. Settlement remains disabled until an explicit database configuration change and is tested only in a rolled-back local transaction.

## Validation pending

The implementation must pass Application, Database, and existing Browser E2E workflows before the migration can be considered for hosted application. Any hosted migration will retain all VietQR flags at `false` and must not create reconciliation data.
