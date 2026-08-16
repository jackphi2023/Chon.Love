# Chon.Love Source-of-Truth Audit — 2026-08-16

## Scope

- GitHub: `jackphi2023/Chon.Love`
- Audited main HEAD at start: `33d66f34d16c85cda59dba61ce626319194167fd`
- Supabase: `asnydvqsduonyidjyyzq`
- Goal: preserve current Chon.Love UI/product behavior and all user data while removing runtime/deploy ambiguity inherited from MyFan → Luxy.Love.

## Executive finding

The current Chon.Love product code is already integrated into `main`; the primary risk is no longer missing LX/Chon features. The largest risk is **multiple technical release narratives living in the same repository**:

1. Root Netlify deploys `apps/mobile` as the current Chon.Love site.
2. Historical scripts/validators still described a combined `apps/public-web + /app` deploy.
3. Creator Activity is hidden in UI but its RPC/Edge runtime still existed.
4. Historical one-time seed/import functions remain deployed, mostly already tombstoned with HTTP 410.
5. Technical identifiers (`@myfan/*`, `luxy_*`, `creator_*`) remain because broad rename would create more migration risk than value.

Cleanup policy: **remove competing runtime/deploy paths; retain historical schema/data unless there is a tested forward migration.**

## Current production data observed

At audit time:

- Auth users: 45.
- Profiles: 45.
- Membership rows/snapshots observed: 28.
- Historical creator profiles: 16.
- Historical creator posts: 2.

These counts are evidence that production data exists and must not be reset/truncated as part of code cleanup.

## GitHub findings

### Already current

Recent merged PRs on `main` already contain:

- Chon.Love homepage/UI consolidation.
- Chon.Love navigation/icons/profile UX.
- Seeking-derived Search/Profile/Interests/Messages flow.
- Premium/Diamond and verification/private-photo contracts.
- Canonical root Netlify build using `apps/mobile`.

### Inconsistency found

Root `netlify.toml` was already canonical Expo Web, but:

- root `package.json` still ran `scripts/build-chon-netlify.mjs`;
- that script embedded Expo under `/app` and rebuilt `apps/public-web`;
- WEB-R03 branding validator still required the combined build;
- BR-10 validator required the opposite architecture: root Expo Web only;
- CI therefore allowed two mutually incompatible release models to coexist.

This was the highest-value deployment cleanup item.

### Legacy runtime routes

`/activity*` had already become redirects but still carried Luxy-era comments. `/creator` still rendered a Luxy.Love placeholder. Cleanup converts all of these into explicit Chon.Love legacy redirects.

## Supabase findings

### Data preservation

No user/Auth/profile/media/membership rows are deleted by this cleanup.

Old migration names and old table names remain because applied migrations are immutable history. Renaming/dropping them would make database replay and backward compatibility worse.

### Private schema

Direct checks at audit time showed:

- `anon` has no `USAGE` on schema `private`.
- `authenticated` has no `USAGE` on schema `private`.
- client roles have no direct SELECT on `private.luxy_memberships` or `private.member_identity_documents`.
- authenticated has no direct write grant on `private.luxy_membership_orders`.

Several `private.*` tables are still RLS-off. Because they are grant-isolated/RPC-only today, this is **defense-in-depth debt**, not a reason to blindly enable RLS in production. RLS hardening should be a dedicated tested migration.

### SECURITY DEFINER surface

Supabase security advisory inventory showed public function execution was broader than necessary.

Cleanup action:

- retire Creator Activity RPC execution for `anon` and `authenticated`;
- preserve `service_role` access for controlled recovery/audit;
- revoke anonymous execution from `admin_get_homepage_settings`, `admin_update_homepage_settings`, and `is_super_admin` while keeping authenticated Admin flow access.

### Existing-user onboarding regression

Production `complete_my_onboarding` rejected policy re-acceptance if an already age-verified user submitted a DOB different from the verified DOB stored earlier. This can route existing users into a confusing 18+ failure during policy refresh.

Cleanup adds a forward migration so an already verified adult:

- preserves verified DOB;
- preserves `age_verified_at`;
- preserves verification method;
- updates only current Terms/Community acceptance fields.

New/unverified users keep the original DOB/18+ verification behavior.

### Edge Functions

Observed one-time functions such as MyFan beta seed/reset, Luxy fixture seed, bootstrap and image import/probe are already tombstoned with HTTP 410 and JWT verification.

`creator-activity-preview` was still an active implementation and must be tombstoned because Creator Activity is not a Chon.Love V1 runtime surface.

## Netlify decision

One release model only:

```text
Repository root /
→ root netlify.toml
→ corepack enable && pnpm --filter @myfan/mobile build:web
→ apps/mobile/dist
```

`apps/public-web` is retained only as non-production legacy source for possible SEO/public-profile extraction. Its Netlify target is fail-closed so it cannot silently replace the Chon.Love homepage.

Non-production Netlify contexts no longer hard-code production Supabase. Preview/staging must receive their own context-scoped backend config.

## Intentional technical legacy retained

The following are not renamed in this cleanup:

- `@myfan/mobile`, `@myfan/admin`, shared package scopes.
- `EXPO_PUBLIC_MYFAN_ENV`.
- `luxy_*` database tables/RPC identifiers that are active contracts.
- historical `creator_*` tables/rows.
- old migration file names.

Reason: each is either a runtime contract or historical database identity. Rename-only churn would increase regression risk without changing user-facing Chon.Love.

## Required release checks

Before merge to `main`:

- Application CI green.
- Database clean reset from repository migrations green.
- New policy re-acceptance test green.
- New retired-runtime grants test green.
- Browser E2E core flow green.
- Netlify validator proves production app is `apps/mobile` only.
- Branding validator proves no active MyFan/Luxy/Creator surface leaks to user-facing routes.

After merge/deploy:

- smoke exact Netlify SHA;
- existing-user login + policy re-accept;
- Search/Profile/Favorite/Message;
- Free/Premium/Diamond/private-photo entitlements;
- verification flow;
- confirm feature flags remain fail-closed.

## Items deliberately deferred

1. Broad internal namespace rename (`@myfan/*` → `@chon/*`).
2. Rename of Supabase project display name.
3. Enabling RLS on private RPC-only tables without a dedicated regression suite.
4. Deleting historical Creator/Activity tables or data.
5. Gift/Wallet/Payout re-enable.
6. Native mobile/EAS release work.

These are separate migrations/refactors, not code hygiene tasks.
