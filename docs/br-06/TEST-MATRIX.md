# BR-06 Test Matrix

| Area | Actor/state | Browser action | Expected result |
|---|---|---|---|
| Auth | Creator, viewer, Fan, outsider | Sign in with local email/password | Each context reaches protected Discovery UI |
| Public Activity | Viewer | Open Creator profile | Approved Activity post, album, and signed image render |
| Friendship | Viewer → Creator | Send greeting and friend request | Viewer receives success state |
| Friendship | Creator | Open received requests and accept | Accepted friendship opens direct chat |
| Friends privacy | Creator | Change Activity visibility to `friends` | Success notice confirms the new tier |
| Friends privacy | Accepted viewer | Reopen Creator profile | Activity post and album remain visible |
| Friends privacy | Outsider | Open Creator profile | Friend gate renders; post and album stay absent |
| Fans privacy | Creator | Change Activity visibility to `fans` | Success notice confirms Fan-only tier |
| Fans privacy | Normal accepted friend | Reopen Creator profile | Fan gate renders; hidden post stays absent |
| Fans privacy | Active Fan | Open Creator profile | Activity post and album remain visible |
| Chat | Accepted viewer | Open chat and send a text message | Optimistic/stable message appears |
| Realtime/state sync | Creator | Open the conversation | Viewer message is available to Creator |
| Reporting | Creator | Report the visible viewer message | Safety success notice appears |
| Blocking | Creator | Block viewer from chat | Sending is disabled immediately |
| Blocking | Viewer | Reload chat | Sending remains disabled for the other participant |
| Blocking | Viewer | Open Creator profile | Profile is unavailable because block overrides access |
| Unblock | Creator | Open blocked list and unblock viewer | Success notice explains friendship is not restored |
| Post-unblock | Viewer | Open Creator profile | New friend-request action is available; chat is absent |
| Post-unblock privacy | Viewer | Inspect Creator Activity | Fan gate remains in force |
| Evidence | Viewer | Finish lifecycle | Final mobile screenshot is attached |

## Infrastructure assertions

The source guard additionally verifies:

- local-only Supabase host allowlist
- exactly four `br06.*@example.test` users in the local database
- no controlled Beta account in the local reset database
- no service-role key exported to Expo or browser runtime
- Chromium and system dependencies installed from a pinned Playwright package
- trace, screenshot, video, HTML report, and workflow artifacts configured
- BR-05 database and application regressions remain mandatory
- no gift, purchase verification, withdrawal, or VietQR operation in the browser contract
- release manifest continues to deny merge, production deploy, and financial enablement
