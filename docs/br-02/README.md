# BR-02 — Beta integration branch normalization

BR-02 replaces the historical stacked pull-request chain with one canonical integration branch:

- branch: `release/beta-mobile-web`
- pull-request base: `develop`
- audited source anchor: `31367a17135cd98078016d264ba2cd9b5335c896`
- production branch: `main` remains unchanged
- deployment state: preview-only; no production authorization

The branch contains the complete Phase A–C application and database source reconciled by BR-01. New Beta work must branch from `release/beta-mobile-web` and return to it through focused pull requests. Legacy feature branches are retained for history only and must not be used as new integration bases.

See:

- `INTEGRATION-MANIFEST.md` for the reconciled topology and superseded PR inventory.
- `BRANCH-POLICY.md` for the working rules.
- `ACCEPTANCE.md` for completion criteria.
- `STATUS.md` for the current verified state.
