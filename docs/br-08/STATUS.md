# BR-08 Status

- Status: implementation and hosted fail-closed migration complete; final documentation-head CI pending
- Head branch: `agent/br-08-kyc-withdrawal-operational-flow`
- Base branch: `agent/br-07-vietqr-reconciliation-mvp`
- Base SHA: `7ab68c3404350bbbd39639dba41465a82430252b`
- Draft pull request: `#21`, open and unmerged
- Validated implementation head: `4d427fd49bf69cf68cc76bf372fabebbc60d2717`
- Hosted migration: `20260731205924_br_08_kyc_withdrawal_operational_flow`
- Hosted migration count: 80
- KYC review flag: disabled
- Bank review flag: disabled
- Withdrawal request flag: disabled
- Withdrawal review flag: disabled
- Processing flag: disabled
- Payout flag: disabled
- Legacy single-control withdrawal RPC: revoked
- New operational RPCs: service-role only; PostgreSQL rechecks `finance_admin` or `super_admin`
- Edge Function hosted deployment: not performed
- Hosted KYC profiles: 0
- Hosted KYC documents: 0
- Hosted bank accounts: 0
- Hosted withdrawals: 0
- Hosted payout-operation events: 0
- BR-08 fixture users on hosted project: 0
- Controlled Beta auth users: 16
- Controlled Beta profiles: 16
- Controlled Beta creators: 16
- Controlled Beta media: 32
- Controlled Beta credentials read, stored or modified: none
- Merge: not authorized
- Production deployment: not authorized

## Implementation workflows

The validated implementation head passed:

- Application CI `#859`, workflow run `30664188749`
- Database CI `#404`, workflow run `30664188772`
- Browser E2E `#118`, workflow run `30664188767`

Database CI clean-reset all 80 repository migrations and passed BR-01 through BR-08, including the 47-assertion KYC/withdrawal operational contract, concurrent gift and withdrawal tests, schema lint, exact generated public database types and full workspace validation.

## Implementation summary

BR-08 adds operational queues for KYC, payout-bank and withdrawal cases, assignment and SLA timestamps, audited access to encrypted PII and KYC documents, immutable payout-operation events, idempotent decisions and withdrawal maker–checker control.

A withdrawal can only move from review to processing through a second finance operator. Recording `paid` requires an explicit bank reference and a SHA-256 evidence hash. These transitions were exercised only in rolled-back local tests.

## Hosted verification

After migration application:

- all six BR-08 flags remained `false`;
- KYC, document, bank-account, withdrawal and payout-operation tables remained at their pre-migration row counts;
- `anon` and `authenticated` retained no private-schema usage or private-table grants;
- operational queue, assignment, review, sensitive-data and payout RPCs were executable only by `service_role`;
- `request_withdrawal`, KYC upload/finalize and the legacy single-control withdrawal RPC remained unavailable to clients;
- the legacy `admin_decide_withdrawal` RPC was not executable by `service_role`;
- the 16 controlled Beta accounts and their profile, Creator and media records remained present.

## Scope boundary

The hosted change is schema and ACL only. The `payout-admin` Edge Function was not deployed, no KYC data was collected, no bank account was reviewed, no withdrawal was created, no money was transferred and no application deployment was created.

The exact final documentation SHA and its Application, Database and Browser workflow identifiers are recorded in Draft PR `#21` after final workflows complete, avoiding another source commit solely to record CI identifiers.
