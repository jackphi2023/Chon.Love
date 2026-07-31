# BR-08 Test Matrix

| Area | Contract |
|---|---|
| Defaults | All six operational and payout flags are `false` |
| ACL | Client cannot upload KYC, request withdrawals or call Admin operations |
| Legacy safety | `admin_decide_withdrawal` is unavailable to `service_role` |
| Roles | Outsider cannot list or operate finance queues |
| Queue | Pending KYC, bank and withdrawal cases are returned with aging/SLA fields |
| Assignment | One finance operator claims a review case; other operators cannot access its PII |
| PII | Sensitive payload and KYC document access are server-only and audited |
| KYC | Assigned reviewer approves/rejects idempotently |
| Bank | Assigned reviewer verifies/rejects; payout eligibility is recomputed |
| Withdrawal review | Assigned reviewer approves or rejects held rewards |
| Dual control | Approver cannot start processing or mark the withdrawal paid |
| Processing | A second finance operator can process only after explicit flag enablement |
| Payout | `paid` requires payout flag, payment reference and 64-character SHA-256 evidence |
| Conservation | Held units move to paid once; retry does not duplicate the ledger |
| Audit | Payout operation events cannot be updated or deleted |
| Isolation | Four ephemeral actors and all financial mutations roll back |
| Regression | BR-01 through BR-07, gift/withdrawal concurrency, lint, generated types and Browser E2E remain green |
