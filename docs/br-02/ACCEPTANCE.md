# BR-02 acceptance criteria

BR-02 is complete only when all criteria below are true:

- [x] `release/beta-mobile-web` exists from the exact audited BR-01 head.
- [x] The canonical branch is ahead of `develop` and not behind it.
- [x] A machine-readable release manifest records branch roles and safety gates.
- [x] Repository validation rejects accidental changes to the canonical topology or release gates.
- [x] Application CI runs on `release/**` and executes both BR-01 and BR-02 guards.
- [x] Database CI runs against the canonical integration pull request.
- [x] One Draft PR targets `develop` from `release/beta-mobile-web`.
- [x] Historical stacked Draft PRs are marked superseded without deleting branches or force-pushing history.
- [ ] Application CI passes on the final BR-02 head.
- [ ] Database CI passes on the final BR-02 head.
- [ ] Final head SHA and workflow run identifiers are recorded in `STATUS.md`.

Passing BR-02 does not mean the Mobile Web Beta is deployed or end-to-end accepted. It only establishes a single trustworthy integration source.
