# BR-03 Acceptance Criteria

BR-03 is complete only when all criteria below are true:

- [x] Email/password sign-in exists and reuses mandatory 18+ onboarding routing.
- [x] Google PKCE authentication remains available.
- [x] Password recovery exists for non-fixture accounts.
- [x] Recovery callbacks allowlist the reset-password destination.
- [x] Password reset revokes all sessions and requires fresh authentication.
- [x] Restored identities are validated with Supabase Auth `getUser()`.
- [x] Application sign-out defaults to global session revocation.
- [x] The controlled 16-account Beta cohort is exempt from self-service recovery and forced rotation.
- [x] No credential is stored in repository source, migration data, tests, documentation, or CI configuration.
- [x] Remote temporary rotation scaffolding is removed.
- [x] Repository migration ledger contains matching inert reconciliation records.
- [x] BR-03 source validation is mandatory in application and database CI.
- [ ] Application CI passes on the final implementation head.
- [ ] Database CI passes on the final implementation head.
- [ ] Existing controlled Beta sessions are revoked after CI passes.
- [ ] Final SHA and workflow run identifiers are recorded in `STATUS.md`.

Passing BR-03 does not authorize production deployment, public tester access, or financial feature enablement.
