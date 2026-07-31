# BR-07 Status

- Status: implementation and hosted fail-closed migration complete; final documentation-head CI pending
- Head branch: `agent/br-07-vietqr-reconciliation-mvp`
- Base branch: `agent/br-06-mobile-web-browser-e2e`
- Base SHA: `28576e5e90980758f341ae386f3614fd2dbb5642`
- Draft pull request: `#20`, open and unmerged
- Validated implementation head: `433398acf1a90606eb0382296cd0ac05fc1d7907`
- Hosted migration: `20260731185855_br_07_vietqr_reconciliation_mvp`
- Hosted migration count: 79
- Reconciliation feature flag: disabled
- Manual settlement feature flag: disabled
- Automatic settlement feature flag: disabled
- VietQR web order feature flag: disabled
- Direct client VietQR heart-order RPCs: revoked
- Direct service-role heart-credit RPC: revoked
- New reconciliation RPCs: service-role only; finance role is rechecked in PostgreSQL
- Admin roles: `finance_admin`, `super_admin`
- Public bank webhook: none
- Edge Function hosted deployment: not performed
- Hosted bank transaction rows: 0
- Hosted reconciliation event rows: 0
- Controlled Beta auth users: 16
- Controlled Beta profiles: 16
- Controlled Beta creators: 16
- Controlled Beta media: 32
- BR-07 fixture users on hosted project: 0
- Controlled Beta credentials read, stored, or modified: none
- Financial release flag: disabled
- Merge: not authorized
- Production deployment: not authorized

## Implementation workflows

The implementation head passed:

- Application CI `#779`, workflow run `30656843957`
- Database CI `#360`, workflow run `30656844090`
- Browser E2E `#81`, workflow run `30656844403`

Database CI clean-reset all 79 repository migrations and passed BR-01 through BR-07, including the 34-assertion VietQR reconciliation contract, concurrent gift and withdrawal tests, schema lint, exact generated database types, and full workspace validation.

## Implementation summary

BR-07 introduces a private bank-transaction inbox, deterministic token matching, immutable reconciliation events, finance-only import/review RPCs, a JWT-protected Edge Function source contract, shared TypeScript contracts, and an Admin reconciliation page.

Import, match, settlement, ignore, and reject are separate operations. Import and matching do not credit hearts. Settlement remains disabled in hosted configuration and was exercised only in a rolled-back local pgTAP transaction.

## Hosted verification

After migration application:

- all four VietQR flags remained `false`;
- reconciliation tables remained empty;
- `anon` and `authenticated` retained no private schema usage or private table grants;
- the three new Admin RPCs were executable only by `service_role`;
- the direct verified-payment RPC was not executable by `anon`, `authenticated`, or `service_role`;
- authenticated access to legacy VietQR user-order RPCs was removed;
- the 16 controlled Beta accounts and their profile, Creator, and media records remained present.

## Scope boundary

The hosted change is schema and ACL only. The Admin Edge Function was not deployed, no finance feature was enabled, no bank transaction was imported, no hearts were credited, and no application or production deployment was created.
