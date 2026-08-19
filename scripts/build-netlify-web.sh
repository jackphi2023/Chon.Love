#!/usr/bin/env bash
set -euo pipefail

corepack enable

# Build the responsive Chon.Love member web app first.
pnpm --filter @myfan/mobile build:web

# The Admin app is a static Next.js export mounted under /admin. Reuse the
# production Supabase public configuration already supplied to the Expo web app,
# while never exposing or requiring a service-role key in the browser bundle.
export NEXT_PUBLIC_MYFAN_ENV="${NEXT_PUBLIC_MYFAN_ENV:-${EXPO_PUBLIC_MYFAN_ENV:-production}}"
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-${EXPO_PUBLIC_SUPABASE_URL:-}}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}}"

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL}" || -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY}" ]]; then
  echo "Missing public Supabase configuration for the Admin build." >&2
  exit 1
fi

pnpm --filter @myfan/admin build

# Keep one Netlify site/domain. Existing /admin static files shadow the Expo SPA
# catch-all rewrite, so member routes and Admin routes can coexist safely.
rm -rf apps/mobile/dist/admin
mkdir -p apps/mobile/dist/admin
cp -R apps/admin/out/. apps/mobile/dist/admin/

# Fail the deployment if the two critical Admin routes were not exported.
test -f apps/mobile/dist/admin/login/index.html
test -f apps/mobile/dist/admin/users/index.html

echo "Built Chon.Love web + /admin static application successfully."
