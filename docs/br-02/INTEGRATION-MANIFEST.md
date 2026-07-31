# BR-02 integration manifest

## Canonical topology

```text
main
└── develop
    └── release/beta-mobile-web
        └── future focused Beta feature branches
```

`release/beta-mobile-web` is the only branch that aggregates the Mobile Web Beta candidate before staging/deployment work. It was created as a fast-forward reference from the audited BR-01 head:

- source branch: `agent/br-01-security-reconciliation`
- source SHA: `31367a17135cd98078016d264ba2cd9b5335c896`
- integration base: `develop`
- merge base: `fb08563f5bbf8ccae6292e27efcde8bb6d762c1c`
- initial relation to `develop`: ahead with zero commits behind

The machine-readable source of truth is `config/releases/beta-mobile-web.json`.

## Included implementation chain

The canonical branch includes the complete effective content of:

1. Phase A foundation and environment isolation.
2. Phase B database, security and shared contracts.
3. Phase C authenticated app/web foundation.
4. Email/OAuth and 18+ onboarding foundations already present in the chain.
5. Profiles and moderated media.
6. Province/nearby discovery.
7. Other-user profile, friendship, report and block flows.
8. Friendship-gated realtime chat.
9. Shared 20-gift catalog.
10. Creator Activity and whole-surface privacy tiers.
11. Public homepage and policy pages.
12. VietQR Mobile Web checkout contract and canonical 34-province reconciliation.
13. BR-01 security cleanup and database source-of-truth reconciliation.

## Superseded stacked pull requests

The following historical Draft PRs are preserved as implementation history but are superseded as integration entrypoints by the BR-02 canonical PR:

- #2 Phase B Sessions 6–11
- #3 Phase C Session 13
- #4 Phase C Session 14
- #5 Phase C Session 15
- #6 Phase C Session 16
- #7 Phase C Session 17
- #8 Phase C Session 18
- #9 Phase C Session 19
- #10 Phase C supplemental Session 23
- #11 Phase C Session 20
- #12 Phase C Session 21
- #13 BR-01 reconciliation

PR #14 was an internal BR-01 prerequisite merge and is already closed/merged into the isolated BR-01 branch.

No historical branch is deleted by BR-02. No force-push is used.

## Release boundaries

BR-02 does not authorize:

- merging to `develop` or `main`;
- production deployment;
- enabling Google Play Billing;
- enabling gift sending;
- enabling Creator withdrawals;
- enabling automatic VietQR settlement;
- changing or deleting existing Supabase data.

The branch is a reviewable Beta integration candidate only. Netlify preview/deployment configuration and end-to-end Beta acceptance remain separate sessions.
