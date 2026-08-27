#!/usr/bin/env bash
set -euo pipefail

corepack enable

# Build the responsive Chon.Love member web app first.
pnpm --filter @myfan/mobile build:web

# The Admin app is a static Next.js export mounted under /admin. Reuse the
# environment-matched public Supabase configuration when it exists. Production
# must never deploy without its public URL/key. Non-production Netlify contexts
# may build without public Supabase config; both Mobile and Admin clients already
# return null/fail closed when configuration is absent.
export NEXT_PUBLIC_MYFAN_ENV="${NEXT_PUBLIC_MYFAN_ENV:-${EXPO_PUBLIC_MYFAN_ENV:-production}}"
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-${EXPO_PUBLIC_SUPABASE_URL:-}}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}}"

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL}" || -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY}" ]]; then
  if [[ "${CONTEXT:-}" == "production" ]]; then
    echo "Missing public Supabase configuration for the production Admin build." >&2
    exit 1
  fi
  echo "Building ${CONTEXT:-non-production} without Supabase configuration; browser clients remain fail-closed."
fi

pnpm --filter @myfan/admin build

# Keep one Netlify site/domain. Existing /admin static files shadow the Expo SPA
# catch-all rewrite, so member routes and Admin routes can coexist safely.
rm -rf apps/mobile/dist/admin
mkdir -p apps/mobile/dist/admin
cp -R apps/admin/out/. apps/mobile/dist/admin/

# Fail the deployment if critical Admin HTML or Next static assets are missing.
# A deploy with HTML but without /admin/_next assets renders as unstyled text and
# cannot hydrate the client-side fail-closed Admin authorization guard.
test -f apps/mobile/dist/admin/login/index.html
test -f apps/mobile/dist/admin/dashboard/index.html
test -f apps/mobile/dist/admin/users/index.html
test -d apps/mobile/dist/admin/_next/static
find apps/mobile/dist/admin/_next/static -type f -name '*.js' -size +0c -print -quit | grep -q .
find apps/mobile/dist/admin/_next/static -type f -name '*.css' -size +0c -print -quit | grep -q .
grep -q '/admin/_next/static/' apps/mobile/dist/admin/login/index.html
grep -q '/admin/_next/static/' apps/mobile/dist/admin/dashboard/index.html

echo "Built Chon.Love web + isolated /admin static application successfully."
