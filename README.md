# MyFan

MyFan is an **18+ Social Creator network** where adults connect with communities, follow Creators and support Creators through digital gifts. It is not a compensated-dating, escort, adult-content or peer-to-peer money-transfer application.

## Phase A status

This branch contains the Phase A product foundation and the Session 4 monorepo skeleton. It intentionally does **not** include production business schema, Play Billing verification, KYC integration or payout automation.

## Technology choices

- **Mobile:** Expo SDK 57, React Native 0.86, TypeScript strict, Expo Router, TanStack Query, Zustand, React Hook Form and Zod.
- **Admin/Public web:** Next.js 16.2 Active LTS with App Router and static export foundation.
- **Backend foundation:** Supabase JS, with PostgreSQL migrations, Edge Functions and tests reserved under `supabase/`.
- **Workspace:** pnpm 10 workspaces; Node.js 22.13 or newer within Node 22.

Expo SDK 57 was selected because the current official SDK table pairs it with React Native 0.86, React 19.2 and Android target/compile SDK 36. Next.js 16.2.11 is the current Active LTS security release selected for both web apps.

## Repository structure

```text
apps/
  mobile/       Expo React Native app and Expo Web skeleton
  admin/        Protected Admin web foundation
  public-web/   Public profile/legal/deletion foundation
packages/
  config/       Product defaults and feature flags
  domain/       Integer ❤️ domain defaults and pure logic
  validation/   Shared Zod schemas, including 18+ validation
  supabase/     Public client factory, env validation and generated-type placeholder
  ui/           Cross-platform design tokens
supabase/
  migrations/
  functions/
  tests/
  seed.sql
docs/phase-a/   Product, business and screen foundations
```

## Prerequisites

- Node.js `>=22.13.0` (Node 22 recommended).
- Corepack enabled.
- pnpm `10.15.x`.
- Android Studio for local Android emulator builds.
- macOS/Xcode for local iOS builds.

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install
```

Copy environment examples without committing local values:

```bash
cp .env.example apps/mobile/.env.local
cp .env.example apps/admin/.env.local
cp .env.example apps/public-web/.env.local
```

Only public Supabase URL and anon/publishable key may be present in client environments. `SUPABASE_SERVICE_ROLE_KEY` is server-side only and must never be used by Expo or browser code.

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

Default local URLs:

- Expo: shown by Expo CLI; press `w` for web or `a` for Android.
- Admin: `http://localhost:3000` unless another port is selected.
- Public web: Next.js selects the next available port when Admin is already running.

## Quality checks

```bash
pnpm validate:workspace
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build` creates static web builds for Admin, Public Web and Expo Web. Native Android `.aab` generation is performed later through EAS Build and cannot be represented by Expo Web export.

## Mobile route groups

```text
(auth)        Authentication placeholders
(onboarding)  DOB, 18+, policy acceptance and profile setup foundation
(tabs)        Discovery, friends/chat, gifts, balances and profile
creator       Creator, KYC, earnings and withdrawal foundation
settings      Safety, block/report and account deletion foundation
```

The current Android application ID `com.myfan.mobile.dev` is a development placeholder. The final production package ID must be confirmed before Google Play product creation or EAS production builds.

## Branch strategy

```text
feature/* → pull request → CI → deploy preview
develop   → development integration
release/* → staging when created
main      → production only after approval
hotfix/*  → urgent production fixes
```

Phase A work remains on `feature/phase-a-foundation`. Do not merge to `main` unless CI passes and the phase completion report approves readiness.

## Security rules

- Never commit `.env`, `.env.local`, service-role keys, database passwords, Google service accounts, Play credentials, KYC credentials, banking data or personal tokens.
- Supabase anon/publishable keys are public client identifiers, but **RLS is mandatory** before exposing business tables.
- Admin authorization must use trusted server-side claims such as `app_metadata`, not a user-editable profile field.
- Purchased `heart_balance` and withdrawable `creator_earnings` remain separate.
- Admin cannot directly edit balances; later financial changes require immutable ledger entries and audit logs.
- Exact user coordinates must never be returned to other clients.

## Current limitations

- Supabase client configuration requires an anon/publishable key before a real connection can be made.
- Admin protected routes are structural placeholders; Auth/RBAC is not yet implemented.
- Public legal pages are placeholders, not final legal documents.
- Native builds, Play Billing and EAS configuration belong to later sessions.
- The HTML prototype is reference material only and is not shipped as a WebView.
