# BR-02 branch policy

## Canonical branch roles

| Branch | Role | Direct feature work |
|---|---|---|
| `main` | Production history | Prohibited |
| `develop` | Stable integration base | Prohibited during Beta normalization |
| `release/beta-mobile-web` | Canonical Mobile Web Beta candidate | Only release metadata or reviewed hotfixes |
| `feature/*`, `agent/*`, `hotfix/*` | Focused implementation branches | Allowed |

## Required flow

```text
release/beta-mobile-web
→ focused feature/hotfix branch
→ Draft PR
→ application CI + database CI
→ review and Beta acceptance
→ merge back to release/beta-mobile-web only after explicit approval
```

A later release session may propose promotion from `release/beta-mobile-web` to `develop`. Promotion to `main` requires a separate release decision and must never be inferred from a passing CI run.

## Rules

1. Do not base new work on the historical stacked Phase B/C branches.
2. Do not force-push the canonical Beta branch.
3. Do not merge Draft PRs automatically.
4. Do not rewrite applied Supabase migrations; add forward migrations.
5. Preserve BR-01 security validation and database clean-reset CI.
6. Keep financial feature flags disabled until their dedicated end-to-end acceptance sessions pass.
7. Netlify preview is not production authorization.
8. Mobile Web changes that alter shared contracts must include an explicit Native parity assessment.
9. Every integration PR must record its exact head SHA and validation runs.
10. Historical branches and PRs may be retained for audit, but they are not sources of truth after BR-02.

## Rollback

The immutable rollback anchor for the start of BR-02 is:

`31367a17135cd98078016d264ba2cd9b5335c896`

A rollback must create a new branch or revert commit. It must not force-move shared history.
