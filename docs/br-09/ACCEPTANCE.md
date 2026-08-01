# BR-09 Acceptance Criteria

- [x] Dedicated branch is stacked on final BR-08.
- [x] Telemetry schema uses bounded allowlists and private immutable storage.
- [x] Runtime ingestion defaults to disabled.
- [x] PII, secrets, purchase tokens, exact location, message content, KYC and bank data are excluded.
- [x] Auth, non-idempotent writes and financial operations never auto-retry.
- [x] Read/idempotent retries are transient-only and bounded to two.
- [x] Mobile critical auth/error states have accessible labels, roles, states and live regions.
- [x] Admin/Public Web have skip links, visible focus and focus recovery.
- [x] Shared UI tests cover WCAG AA contrast and 44-point touch targets.
- [x] Browser tests cover axe, keyboard, touch targets, reduced motion and no mutation retry.
- [ ] Application, Database and Browser workflows pass on implementation head.
- [ ] Generated public database types exactly match.
- [ ] Hosted migration is applied with ingestion disabled and zero event rows.
- [ ] Controlled Beta data remains unchanged.
- [ ] Draft PR remains open and unmerged; no Edge Function/vendor/app deployment.
