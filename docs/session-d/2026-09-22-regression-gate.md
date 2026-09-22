# Session D — OPT-QA Regression Gate (2026-09-22)

## Candidate

- Repository: `jackphi2023/Chon.Love`
- Candidate SHA: `0c19dc26e84db7cc4ae8be3df584785e439ab169`
- Source: Session C candidate branch (PR #113); no merge to `main`.
- Netlify: **not deployed**.

## Automated gates

| Gate | Run | Result |
|---|---:|---|
| CI / lint / typecheck | #3604 | PASS |
| Database contracts | #1993 | PASS |
| Browser E2E (BR-06 + BR-09) | #2199 | PASS |
| LX-15 entitlement | #689 | PASS |

The Browser E2E run includes the Session C regression repair for OPT-09 gift realtime. The focused Admin responsive suite is 5/5 PASS at 390px, 430px and 1280px with synthetic RPC fixtures; hosted production parity is checked separately below.

## Session D mandatory coverage

- Signup and selfie verification flow: covered by BR-06 Browser E2E and hosted function/schema contracts.
- AWS Rekognition CompareFaces path: existing live-selfie JPEG flow remains in scope; similarity threshold and provider/quality failures remain fail-closed for review.
- Connect: approved-avatar and membership badge gates covered by BR-06 contracts.
- Profile: public/private media, badge rendering, profile edit visibility and SEO coverage pass.
- Admin: signup time ordering, verification queue ordering, media/linkage, responsive layout and Hero upload dimensions pass.
- Homepage Hero: desktop and mobile routes covered; upload validation enforces 1600×900 (16:9) desktop and 1080×1920 (9:16) mobile.
- SEO: favicon/thumbnail and public-profile metadata contracts pass.
- Balance/Gift/Chat: BR-06 contracts pass; gift history realtime publication verified in production.
- Accessibility/observability/resilience: LX-15 and BR-09 checks pass; no skip/fixme/timeout inflation was introduced.

## Hosted Supabase parity

Project: `asnydvqsduonyidjyyzq`

Verified after applying the idempotent migration `opt_09_gift_transactions_realtime_publication`:

- Migration ledger includes `20260922141628 opt_09_gift_transactions_realtime_publication`.
- `supabase_realtime` publishes both `public.gift_transactions` and `public.messages`.
- `admin_list_luxy_users` returns `signup_at` from `auth.users.created_at` and orders by `u.created_at desc, p.id`.
- `admin_list_member_photo_verifications` returns only open/queued/in-review member-photo cases and orders newest first.
- `get_public_homepage_settings` exposes the published Hero/media fields through a stable security-definer read path.

The migration is DDL-only, idempotent, and does not modify ledger rows, settlement behavior, financial flags, or authorization policy.

## Scope decisions and blockers

- AWS Face Liveness is **DEFERRED / OUT OF SCOPE** per the accepted Session B handoff; do not add it as a release blocker.
- Financial execution remains fail-closed.
- No production deploy or `main` merge is authorized by this QA record. Session E must issue the final release report and explicit deploy handoff.

## Session D result

**PASS — code and hosted Supabase parity gates complete for candidate SHA `0c19dc26e84db7cc4ae8be3df584785e439ab169`.**

Release remains intentionally held for Session E sign-off and the user's explicit Netlify deployment action.
