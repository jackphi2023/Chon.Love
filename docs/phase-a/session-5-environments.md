# Session 5 — Environment foundation

## Goal

Maintain isolated development, staging and production environments for MyFan without allowing frontend builds to connect to the wrong Supabase project.

## Supabase environment matrix

| Environment | Git branch | Project | Project ref | Region | Current lifecycle |
|---|---|---|---|---|---|
| Development | `develop` | MyFan Development | `qxsqrtnelbqquqgbamjo` | Singapore (`ap-southeast-1`) | Paused on Free plan |
| Staging | `release/staging` | MyFan Staging | `fciyrjtqnifapafqythy` | Singapore (`ap-southeast-1`) | Paused on Free plan |
| Production | `main` | MyFan MobileApp | `asnydvqsduonyidjyyzq` | Singapore (`ap-southeast-1`) | Active |

The three project refs and API URLs are unique. Database, Auth, Storage, Edge Functions and API credentials therefore remain isolated.

The current Supabase organization is on the Free plan and permits only two active free projects for the account. The production project remains active; development and staging were provisioned and then paused. Restore only the environment being used, or upgrade the organization before simultaneous cloud testing.

## Git promotion flow

```text
feature/*
  -> develop                development
  -> release/staging        staging
  -> main                   production after approval
```

No feature branch may write directly to production. Database migrations introduced from Session 6 onward must be committed under `supabase/migrations/` and applied to development before staging and production.

## Local environment files

Copy exactly one matching template:

```bash
cp .env.development.example .env.local
cp .env.staging.example .env.local
cp .env.production.example .env.local
```

Never combine a `MYFAN_ENV` label from one environment with a Supabase URL or key from another environment.

The committed templates intentionally leave publishable/anon keys and the service-role key blank. Frontend applications may use only a publishable key. The service-role key is server-side only and must never be added to Expo, browser code or Netlify frontend sites.

## Netlify site model

Create three Netlify projects linked to `jackphi2023/myfan`:

| Suggested site | Package directory | Build output |
|---|---|---|
| `myfan-mobile-web` | `apps/mobile` | `apps/mobile/dist` |
| `myfan-admin` | `apps/admin` | `apps/admin/out` |
| `myfan-public` | `apps/public-web` | `apps/public-web/out` |

For every site:

- Base directory: repository root.
- Package directory: the matching app directory above.
- Production branch: `main`.
- Enabled branch deploys: `develop` and `release/staging`.
- Deploy Previews: enabled for pull requests.
- Configuration: the app-local `netlify.toml`.
- Publishable key: set in Netlify UI/API with a distinct value for production, `develop`, `release/staging` and Deploy Preview contexts.

The app-local Netlify configurations commit only public project URLs and environment labels. They do not commit Supabase keys.

## Netlify connection blocker

The current ChatGPT workspace has GitHub and Supabase access but no Netlify connector, MCP connection or Netlify access token. Repository-side Netlify configuration is complete, but the actual Netlify project records, default URLs and contextual environment variables cannot be created from this session. They must be created after Netlify is connected.

## Automated controls

`pnpm validate:environments` fails CI when:

- two environments share the same Supabase project ref or URL;
- an environment points at the wrong Git branch;
- an `.env.*.example` file mixes labels and URLs;
- a committed example contains a Supabase key value;
- a Netlify configuration omits an environment URL or commits a key.

## Session status

- Three independent Supabase projects: provisioned.
- Production restored: yes.
- Development and staging paused to stay within Free-plan capacity: yes.
- Git branch/environment mapping: implemented.
- Environment examples and CI guard: implemented.
- Netlify monorepo configuration: implemented.
- Netlify projects and URLs: blocked until Netlify access is connected.
