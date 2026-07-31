# BR-08 Acceptance Criteria

- [x] Dedicated branch is stacked on final BR-07.
- [x] KYC, bank and withdrawal queues expose redacted operational metadata only.
- [x] Cases support assignment and SLA timestamps.
- [x] PII and KYC documents require assignment, finance role and audit request ID.
- [x] Six operational/financial flags default to `false`.
- [x] Authenticated KYC upload and withdrawal request paths are revoked.
- [x] Legacy single-control withdrawal operation is revoked.
- [x] Withdrawal approval and payment require distinct operators.
- [x] Marking paid requires a bank reference and SHA-256 payment evidence.
- [x] Operation request IDs are idempotent and conflicting reuse fails closed.
- [x] Payout operation events are immutable.
- [x] Admin UI supports KYC, bank and withdrawal operations.
- [x] Shared TypeScript/Zod contract covers queues, PII access and decisions.
- [x] BR-08 source validation passes on implementation head.
- [x] Application CI passes on implementation head.
- [x] Database CI clean-resets 80 migrations and passes the 47-assertion BR-08 contract.
- [x] Generated public database types exactly match the committed contract.
- [x] BR-06 Browser E2E regression passes on implementation head.
- [x] Hosted migration is applied with all six BR-08 flags `false`.
- [x] Hosted payout-operation table remains empty.
- [x] Hosted KYC, bank and withdrawal row counts remain unchanged.
- [x] Controlled Beta users/profiles/creators/media remain unchanged.
- [x] Draft PR remains open, unmerged, with no Edge Function or production deployment.

Passing BR-08 validates the operational control plane. It does not authorize collecting KYC from Beta users, enabling withdrawal requests, transferring money, or marking a real withdrawal paid.

Final documentation-head workflow identifiers are recorded in Draft PR `#21` after those workflows complete, so recording evidence does not create another source commit.
