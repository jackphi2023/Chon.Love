# BR-06 Acceptance Criteria

BR-06 is complete only when every criterion below is true:

- [x] A dedicated BR-06 branch exists from the validated BR-05 head.
- [x] Browser E2E uses local Supabase and refuses hosted URLs.
- [x] Four isolated local Auth actors are created without controlled Beta credentials.
- [x] Expo Web receives only a local anonymous key.
- [x] Service-role material is excluded from browser runtime and artifacts.
- [x] Mobile viewport is fixed at 390×844 for each actor context.
- [x] Email/password login is exercised through the UI.
- [x] Approved Creator Activity and the derived album render through the UI.
- [x] Friend request and acceptance are exercised through the UI.
- [x] Public, friends, and fans Creator privacy transitions are exercised through the UI.
- [x] Accepted-friend, active-Fan, and outsider access differences are asserted.
- [x] Direct chat and message delivery are exercised through the UI.
- [x] Message reporting is exercised through the UI.
- [x] Blocking disables chat and hides the profile through the UI.
- [x] Unblocking does not restore the old friendship or chat.
- [x] Final browser evidence is attached.
- [x] Trace, screenshot, video, report, and workflow artifact retention are configured.
- [x] Financial operations are excluded and feature flags remain disabled.
- [ ] BR-06 source validation passes on the implementation head.
- [ ] Application CI passes on the implementation head.
- [ ] Database CI passes after clean reset from all repository migrations.
- [ ] Browser E2E workflow passes on the implementation head.
- [ ] Final SHA and workflow run identifiers are recorded in `STATUS.md`.
- [ ] Draft PR remains open, unmerged, and without production deployment.

Passing BR-06 proves the local Expo Web browser lifecycle. It does not prove Netlify preview behavior, physical-device behavior, native permissions, Play Billing, or store readiness.
