# BR-06 — Mobile Web Multi-account Browser E2E

BR-06 adds the first browser-driven end-to-end contract for the authenticated Expo Web application. It is stacked on the validated BR-05 head and converts the existing RPC-level social and Creator contracts into real UI interactions.

## Scope

The Playwright lifecycle runs four isolated local actors in separate 390×844 Chromium browser contexts:

- Creator
- normal viewer/friend
- active Fan
- unrelated outsider

The browser exercises:

- email/password login and protected-route routing
- Creator profile and approved Activity image rendering
- Activity-derived album rendering through signed local Storage URLs
- friend request and acceptance
- `public → friends → fans` Creator privacy changes
- friend, Fan, and outsider access differences
- direct chat creation and message delivery
- message reporting
- block-driven chat/profile shutdown
- unblock without automatic friendship or chat restoration

## Isolation model

BR-06 is deliberately local-only:

1. GitHub Actions starts Supabase locally.
2. The database is reset from all repository migrations.
3. A server-side fixture script creates four temporary Auth users and one tiny image in local Storage.
4. SQL completes adult identity, profiles, Creator approval, Activity content, and Fan membership.
5. Expo Web receives only the local API URL and local anonymous key.
6. Playwright runs the browser lifecycle.
7. The complete local Supabase stack is destroyed at the end of the job.

The fixture script rejects any Supabase hostname other than `localhost` or `127.0.0.1`. The service-role key is used only by the Node fixture step and is never written to `GITHUB_ENV`, an Expo public variable, browser storage, Playwright source, or artifacts.

## Evidence

The workflow retains on failure:

- Playwright trace
- screenshot
- video
- HTML report

The successful lifecycle also attaches a final unblocked-profile screenshot to the test result.

## Explicit exclusions

BR-06 does not:

- use any of the 16 controlled Beta accounts
- read or modify the operator-issued fixed credential
- access the hosted Supabase project
- deploy a Netlify preview
- test a physical Android/iOS device
- test Google Play Billing, gift sending, Creator withdrawals, or VietQR settlement
- authorize merge or production deployment

Financial feature flags remain disabled.
