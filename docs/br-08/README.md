# BR-08 — KYC and Withdrawal Operational Flow

BR-08 turns the existing KYC, payout-bank and manual-withdrawal database foundations into an auditable operational workflow. It is stacked on the validated BR-07 head and does not enable financial activity for Beta users.

## Scope

- finance queues for KYC, bank-account and withdrawal cases;
- assignment and SLA timestamps;
- audited access to encrypted PII and 60-second KYC document URLs;
- idempotent KYC and bank decisions;
- withdrawal maker–checker control;
- required bank reference and SHA-256 payment evidence before `paid`;
- immutable payout-operation events;
- responsive Admin operations page;
- source, pgTAP, type and CI guards.

## Fail-closed boundary

Six database flags default to `false`: KYC review, bank review, withdrawal requests, withdrawal review, processing and payout. Authenticated KYC upload and withdrawal-request RPCs are revoked. The legacy single-operator withdrawal decision RPC is revoked from `service_role`.

The `payout-admin` Edge Function remains source-only until separately authorized. BR-08 does not transfer money, create withdrawal fixtures on hosted Supabase, enable payout, merge a branch or deploy an application.
