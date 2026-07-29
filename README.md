# MyFan

MyFan is an **18+ Social Creator network** for safe community connections and digital Creator support.

## Platforms

One Expo React Native codebase runs as Mobile Web, Android and iOS. Admin and Public Web use Next.js. All clients share one Supabase backend and one generated public database contract.

## Canonical Supabase

```text
MyFan MobileApp
asnydvqsduonyidjyyzq
https://asnydvqsduonyidjyyzq.supabase.co
ap-southeast-1
```

Development, staging and production are release labels only; they all use this project. Service-role/database credentials never enter Expo, browser or `NEXT_PUBLIC_*`/`EXPO_PUBLIC_*` variables.

## Install and frontend

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm dev:mobile
pnpm dev:admin
pnpm dev:public
```

## Database workflow

Docker and Supabase CLI are required locally.

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm supabase:test
pnpm supabase:lint
pnpm supabase:types
pnpm supabase:stop
```

Migrations are authoritative. CI starts an ephemeral Supabase stack, resets from migrations, seeds, runs pgTAP and lint, validates generated public objects, then runs repository lint/typecheck/tests.

## Session 6

Implemented public administrative areas/profiles/Creator profiles; private DOB/age assurance/roles/config; Auth bootstrap; 18+ onboarding/profile RPCs; RLS; integer ❤️ config; generated types and shared wrappers for Web/Android/iOS.

## Security

RLS is mandatory for exposed tables. Never authorize from user-editable metadata. Private DOB, roles, config, future KYC/bank/location/finance data stay outside public client tables. Clients cannot edit roles, config, moderation approval, balances or payout status.

## Branch flow

`feature/* -> develop -> release/staging -> main after approval`. Because all labels share one backend, every applied migration changes the canonical service and requires tests/review.
