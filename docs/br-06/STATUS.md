# BR-06 Status

- Status: complete; Draft Beta candidate
- Draft pull request: `#19`, open and Draft
- Head branch: `agent/br-06-mobile-web-browser-e2e`
- Base branch: `agent/br-05-creator-activity-privacy-album-e2e`
- Base SHA: `06b14212100495b557f2af881b15129cad012e10`
- Validated implementation SHA: `98b55a8a68ded63fcad2be4e53cc3dd01f84442d`
- Application CI: `#738`, workflow run `30652268413`, success
- Database CI: `#335`, workflow run `30652269377`, success
- Browser E2E: `#57`, workflow run `30652268452`, success
- Successful browser evidence artifact: `8801940025`
- Browser evidence digest: `sha256:dba05866ae0806b9e1faa91fd5f3fb66a4aa79acb4c9d5335085063a1c54320f`
- Browser runner: Playwright Chromium `1.55.0`
- Browser viewport: `390×844`
- Local fixture accounts: 5
- Browser actors: 4 — Creator, viewer/friend, active Fan, outsider
- Non-browser fixture: 1 local moderator used only as media approval actor
- Browser Supabase target: local CLI stack only
- Local database migrations reset and tested: 78
- Hosted migration: `20260731172253_br_06_storage_policy_helper_execution`
- Hosted migration ledger verified after apply: 78 entries, latest `20260731172253`
- Hosted browser fixture execution: none
- Controlled Beta users used: none
- Controlled Beta credentials read, stored, or modified: none
- Service-role exposed to browser: no
- Financial operations included: none
- Financial features: disabled
- Merge: not authorized
- Production deployment: not authorized

## Findings closed by BR-06

1. **Audited approved-media fixture:** the first local browser fixture omitted the mandatory `approved_by` identity. BR-06 now creates a fifth local moderator account and records it as the media approval actor. No database constraint was removed or weakened.
2. **Local development transport:** the public Supabase client rejected local HTTP before Auth initialization. HTTP is now allowed only for `localhost` or `127.0.0.1`, only through an explicit option, and only when the mobile environment is `development`. HTTPS remains mandatory for staging, production, and remote addresses.
3. **Post-login routing loop:** the Auth screen and submit handler both redirected after login, causing a Native Stack maximum-update-depth loop. Navigation is now single-source and uses the authenticated destination returned by `signInWithEmailPassword`.
4. **Storage signed-URL ACL:** BR-01 broad privilege hardening removed the function execution capability required by Storage RLS to call `private.can_view_media_internal`. Migration `20260731172253` restores only `EXECUTE` for `anon` and `authenticated`; client roles still have no private-schema usage and no direct private-table grants.
5. **Browser selector state:** hidden conversation previews duplicated visible message text, and the normal profile helper incorrectly required a visible profile header during the blocked state. Locators now target the visible message bubble, while blocked navigation asserts the unavailable-profile screen directly.

## Browser lifecycle passed

The successful browser workflow validates through the real Expo Web UI:

- four independent logins
- protected Discovery routing
- public Creator Activity image and Activity Album rendering
- signed local Storage URL access
- friend request and acceptance
- `public → friends → fans` privacy changes
- friend, Fan, and outsider visibility differences
- direct chat and cross-account message visibility
- message reporting
- block-driven chat shutdown and hidden profile
- unblock without restoring the old friendship or chat
- final screenshot evidence

## Scope boundary

BR-06 proves the local Expo Web multi-account lifecycle and least-privilege Storage policy integration. It does not create a Netlify preview, install an APK, test physical Android/iOS devices, exercise native permissions, or validate Google Play Billing. Passing BR-06 does not authorize merge, production deployment, public tester access, or financial feature enablement.
