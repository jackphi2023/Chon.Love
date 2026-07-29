# MyFan

MyFan is an **18+ Social Creator network** where adults connect with communities, follow Creators and support Creators through digital gifts. It is not a compensated-dating, escort, adult-content or peer-to-peer money-transfer application.

## Phase A status

This branch contains the Phase A product foundation and the Session 4–5 repository/environment foundation. It intentionally does **not** include production business schema, Play Billing verification, KYC integration or payout automation.

## Technology choices

- **Mobile:** Expo SDK 57, React Native 0.86, TypeScript strict, Expo Router, TanStack Query, Zustand, React Hook Form and Zod.
- **Admin/Public web:** Next.js 16.2 Active LTS with App Router and static export foundation.
- **Backend foundation:** three isolated Supabase projects, with PostgreSQL migrations, Edge Functions and tests reserved under `supabase/`.
- **Workspace:** pnpm 10 workspaces; Node.js 22.13 or newer within Node 22.

## Repository structure

```text
apps/
  mobile/       Expo React Native app, Expo Web and Netlify config
  admin/        Protected Admin web foundation and Netlify config
  public-web/   Public profile/legal/deletion foundation and Netlify config
packages/
  config/       Product defaults, environment names and feature flags
  domain/       Integer ❤️ domain defaults and pure logic
  validation/   Shared Zod schemas, including 18+ validation
  supabase/     Public client factory, env validation and generated-type placeholder
  ui/           Cross-platform design tokens
config/environments/  Canonical dev/staging/production mapping
supabase/
  migrations/
  functions/
  tests/
  seed.sql
docs/phase-a/   Product, business, screen and environment foundations
```

## Prerequisites

- Node.js `>=22.13.0`.
- Corepack enabled.
- pnpm `10.15.x`.
- Android Studio for local Android emulator builds.
- macOS/Xcode for local iOS builds.

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
```

## Environments

| Environment | Branch | Supabase ref | Cloud status |
|---|---|---|---|
| Development | `develop` | `qxsqrtnelbqquqgbamjo` | Paused on Free plan |
| Staging | `release/staging` | `fciyrjtqnifapafqythy` | Paused on Free plan |
| Production | `main` | `asnydvqsduonyidjyyzq` | Active |

Use one matching template:

```bash
cp .env.development.example .env.local
# or .env.staging.example / .env.production.example
```

Only public Supabase URL and publishable/anon key may be present in client environments. `SUPABASE_SERVICE_ROLE_KEY` is server-side only and must never be used by Expo, browser code or Netlify frontend sites.

See `docs/phase-a/session-5-environments.md` for provisioning, Free-plan lifecycle and Netlify setup details.

## Development

```bash
pnpm dev:mobile
pnpm dev:admin
pnpm dev:public
```

Run all three development processes:

```bash
pnpm dev
```

## Quality checks

```bash
pnpm validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm validate:environments` prevents shared Supabase project refs, wrong branch mappings, mixed environment templates and committed key values.

`pnpm build` creates static web builds for Admin, Public Web and Expo Web. Native Android `.aab` generation is performed later through EAS Build.

## Netlify

Each app contains its own `netlify.toml`. Link three Netlify projects to this monorepo and set the corresponding Package directory:

```text
apps/mobile
apps/admin
apps/public-web
```

Use `main` for production, `release/staging` for staging and `develop` for development. Store publishable keys as contextual Netlify environment variables rather than committing them.

## Mobile route groups

```text
(auth)        Authentication placeholders
(onboarding)  DOB, 18+, policy acceptance and profile setup foundation
(tabs)        Discovery, friends/chat, gifts, balances and profile
creator       Creator, KYC, earnings and withdrawal foundation
settings      Safety, block/report and account deletion foundation
```

The current Android application ID `com.myfan.mobile.dev` is a development placeholder. Confirm the production package ID before Google Play product creation or EAS production builds.

## Branch strategy

```text
feature/*       -> pull request and development validation
develop         -> development integration
release/staging -> staging
main            -> production only after approval
hotfix/*        -> urgent production fixes
```

Phase A work remains on `feature/phase-a-foundation`. Do not merge to `main` until Phase A review approves readiness.

## Security rules

- Never commit `.env`, `.env.local`, service-role keys, database passwords, Google service accounts, Play credentials, KYC credentials, banking data or personal tokens.
- Supabase publishable/anon keys are public client identifiers, but **RLS is mandatory** before exposing business tables.
- Admin authorization must use trusted server-side claims such as `app_metadata`, not a user-editable profile field.
- Purchased `heart_balance` and withdrawable `creator_earnings` remain separate.
- Admin cannot directly edit balances; later financial changes require immutable ledger entries and audit logs.
- Exact user coordinates must never be returned to other clients.

## Current limitations

- Development and staging Supabase projects are paused due the Free-plan active-project limit.
- Publishable keys must still be entered in local/Netlify environment settings.
- Netlify project records have not been created because Netlify access is not connected to this workspace.
- Admin protected routes are structural placeholders; Auth/RBAC is not yet implemented.
- Public legal pages are placeholders, not final legal documents.
- Native builds, Play Billing and EAS configuration belong to later sessions.
- The HTML prototype is reference material only and is not shipped as a WebView.
