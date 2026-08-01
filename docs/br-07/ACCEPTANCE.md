# BR-07 Acceptance Criteria

BR-07 is complete only when every criterion below is true:

- [x] A dedicated branch exists from the validated BR-06 head.
- [x] Reconciliation data is stored only in private tables.
- [x] Bank transaction provider/reference pairs are unique.
- [x] Import and finance decisions have separate idempotency keys.
- [x] Import never credits hearts.
- [x] Exact token and amount matching is deterministic.
- [x] Missing tokens become `unmatched`.
- [x] Amount mismatch becomes `needs_review`.
- [x] Ignore and reject require audit reason codes.
- [x] Reconciliation events are immutable.
- [x] Only `finance_admin` and `super_admin` can use privileged RPCs.
- [x] Edge Function verifies JWT and keeps service-role material server-side.
- [x] Direct service-role access to the heart-credit RPC is revoked.
- [x] Authenticated access to legacy VietQR user-order RPCs is revoked.
- [x] Reconciliation import, manual settlement, auto settlement, and web order flags default to disabled.
- [x] Admin UI supports import, filtering, match, settle, ignore, and reject actions.
- [x] Shared TypeScript and Zod contracts cover queue and decisions.
- [x] Financial release manifest remains disabled and merge/deploy remain unauthorized.
- [x] BR-07 source validation passes on the implementation head.
- [x] Application CI passes on the implementation head.
- [x] Database CI clean-resets all migrations and passes the 34-assertion BR-07 contract.
- [x] BR-06 Browser E2E regression passes on the implementation head.
- [x] Generated public database types exactly match the committed contract.
- [x] Hosted migration is applied with all four VietQR flags still false.
- [x] Hosted reconciliation tables remain empty after migration.
- [x] Hosted ACL and 16 controlled Beta users are verified unchanged.
- [x] Validated implementation SHA and workflow run identifiers are recorded in `STATUS.md`.
- [x] Draft PR remains open, unmerged, and without production deployment.

Passing BR-07 proves the reconciliation control plane and its local settlement contract. It does not authorize hosted manual settlement, automatic bank callbacks, Android VietQR payment, Google Play Billing, or production use.

Final documentation-head workflow identifiers are recorded in Draft PR `#20` after those workflows complete, so recording evidence does not create another source commit.
