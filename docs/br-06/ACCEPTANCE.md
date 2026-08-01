# BR-06 Acceptance Criteria

BR-06 is complete only when every criterion below is true:

- [x] A dedicated BR-06 branch exists from the validated BR-05 head.
- [x] Browser E2E uses local Supabase and refuses hosted URLs.
- [x] Five isolated local Auth accounts are created without controlled Beta credentials.
- [x] Exactly four accounts receive mobile browser contexts.
- [x] A separate non-browser moderator account provides valid media approval audit identity.
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
- [x] Local HTTP is explicit, localhost-only, development-only, and covered by unit tests.
- [x] Post-login navigation has one routing source and no competing Auth effect.
- [x] Storage signed URLs have the minimum helper execution capability required by RLS.
- [x] Client roles retain no private-schema usage or direct private-table grants.
- [x] Financial operations are excluded and feature flags remain disabled.
- [x] BR-06 source validation passes on implementation head `98b55a8a68ded63fcad2be4e53cc3dd01f84442d`.
- [x] Application CI #738 passes on the implementation head.
- [x] Database CI #335 passes after clean reset from all 78 repository migrations.
- [x] Browser E2E #57 passes on the implementation head.
- [x] Validated SHA and workflow run identifiers are recorded in `STATUS.md`.
- [x] Draft PR #19 remains open, unmerged, and without production deployment.

Passing BR-06 proves the local Expo Web browser lifecycle and the least-privilege Storage policy integration. It does not prove Netlify preview behavior, physical-device behavior, native permissions, Play Billing, or store readiness.
