import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const appConfig = json('apps/mobile/app.json');
const packageJson = json('package.json');
const nodeVersion = read('.node-version').trim();
const pnpmVersion = /^pnpm@(.+)$/u.exec(packageJson.packageManager ?? '')?.[1] ?? '';
const redirects = read('apps/mobile/public/_redirects');
const rootNetlify = read('netlify.toml');
const mobileNetlify = read('apps/mobile/netlify.toml');
const netlifyBuildScript = read('scripts/build-netlify-web.sh');
const adminSupabase = read('apps/admin/src/lib/supabase.ts');
const adminGuard = read('apps/admin/app/admin-route-guard.tsx');
const adminProtectedLayout = read('apps/admin/app/(protected)/layout.tsx');
const adminShell = read('apps/admin/app/(protected)/admin-shell.tsx');
const adminShellCss = read('apps/admin/app/admin-shell.css');
const sharedSupabase = read('packages/supabase/src/index.ts');
const ci = read('.github/workflows/ci.yml');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };
const productionProjectUrl = 'https://asnydvqsduonyidjyyzq.supabase.co';
const count = (text, needle) => text.split(needle).length - 1;

expect(appConfig.expo?.web?.bundler === 'metro', 'Mobile Web must keep the Metro bundler.');
expect(appConfig.expo?.web?.output === 'single', 'Mobile Web must export as a single-page application for dynamic authenticated routes.');
expect(/^\/\*\s+\/index\.html\s+200\s*$/mu.test(redirects), 'Netlify SPA fallback must rewrite every route to /index.html with status 200.');

for (const [label, netlify] of [['root', rootNetlify], ['apps/mobile mirror', mobileNetlify]]) {
  expect(
    netlify.includes('command = "bash scripts/build-netlify-web.sh"'),
    `${label} Netlify configuration must use the canonical combined Web + Admin build script.`,
  );
  expect(netlify.includes('publish = "apps/mobile/dist"'), `${label} publish directory must be apps/mobile/dist.`);
  expect(
    Boolean(nodeVersion)
      && Boolean(pnpmVersion)
      && netlify.includes(`NODE_VERSION = "${nodeVersion}"`)
      && netlify.includes(`PNPM_VERSION = "${pnpmVersion}"`),
    `${label} Node and pnpm versions must match repository pins.`,
  );
  expect(
    netlify.includes('[context.production.environment]')
      && netlify.includes('EXPO_PUBLIC_MYFAN_ENV = "production"')
      && netlify.includes(`EXPO_PUBLIC_SUPABASE_URL = "${productionProjectUrl}"`),
    `${label} production context must point to the current Chon.Love Supabase project.`,
  );
  expect(
    netlify.includes('[context.deploy-preview.environment]') && netlify.includes('[context.branch-deploy.environment]'),
    `${label} Deploy Preview and branch deploy contexts must remain explicit.`,
  );
  expect(
    count(netlify, productionProjectUrl) === 1,
    `${label} must hard-code the production Supabase URL only once; previews/staging must be configured separately.`,
  );
  for (const flag of [
    'EXPO_PUBLIC_FEATURE_GOOGLE_PLAY_BILLING',
    'EXPO_PUBLIC_FEATURE_SEND_GIFT',
    'EXPO_PUBLIC_FEATURE_CREATOR_WALLET',
    'EXPO_PUBLIC_FEATURE_CREATOR_KYC',
    'EXPO_PUBLIC_FEATURE_WITHDRAWAL',
  ]) {
    expect(netlify.includes(`${flag} = "false"`), `${label}: ${flag} must remain disabled for Web V1.`);
  }
  expect(!netlify.includes('SUPABASE_SERVICE_ROLE_KEY'), `${label} frontend configuration must never contain a service-role key.`);
  expect(!netlify.includes('MYFAN_PII_ENCRYPTION_KEY_B64'), `${label} frontend configuration must never contain the PII encryption key.`);
  expect(!/EXPO_PUBLIC_SUPABASE_ANON_KEY\s*=\s*"[^"]+"/u.test(netlify), `${label}: Supabase publishable key must be configured in Netlify UI, not committed.`);
  expect(netlify.includes('X-Content-Type-Options = "nosniff"') && netlify.includes('X-Frame-Options = "DENY"'), `${label} security headers must remain enabled.`);
  expect(netlify.includes('for = "/seo/*"') && netlify.includes('Cache-Control = "public, max-age=31536000, immutable"'), `${label} versioned SEO assets must use immutable long-lived caching.`);
  expect(netlify.includes('for = "/admin/*"') && netlify.includes('X-Robots-Tag = "noindex, nofollow, noarchive"'), `${label} Admin routes must be no-store/noindex.`);
}

expect(netlifyBuildScript.includes('pnpm --filter @myfan/mobile build:web'), 'Combined Netlify build must compile canonical Mobile Web.');
expect(netlifyBuildScript.includes('pnpm --filter @myfan/admin build'), 'Combined Netlify build must compile Admin.');
expect(netlifyBuildScript.includes('cp -R apps/admin/out/. apps/mobile/dist/admin/'), 'Combined Netlify build must mount Admin output below /admin.');
expect(netlifyBuildScript.includes('apps/mobile/dist/admin/login/index.html') && netlifyBuildScript.includes('apps/mobile/dist/admin/dashboard/index.html') && netlifyBuildScript.includes('apps/mobile/dist/admin/users/index.html'), 'Combined Netlify build must fail closed if core Admin routes are missing.');
expect(netlifyBuildScript.includes("-name '*.js'") && netlifyBuildScript.includes("-name '*.css'"), 'Combined Netlify build must require non-empty Admin JS and CSS assets.');
expect(count(netlifyBuildScript, "grep -q '/admin/_next/static/'") >= 2, 'Combined Netlify build must verify exported Admin HTML points at /admin/_next static assets.');
expect(!netlifyBuildScript.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Combined Netlify build must never require a service-role key.');
expect(
  netlifyBuildScript.includes('if [[ "${CONTEXT:-}" == "production" ]]')
    && netlifyBuildScript.includes('Missing public Supabase configuration for the production Admin build.')
    && netlifyBuildScript.includes('exit 1'),
  'Combined Netlify build must fail if production is missing public Supabase configuration.',
);
expect(
  netlifyBuildScript.includes('Building ${CONTEXT:-non-production} without Supabase configuration; browser clients remain fail-closed.'),
  'Non-production Netlify builds must be allowed without Supabase credentials while browser clients remain fail-closed.',
);

expect(sharedSupabase.includes('storageKey?: string;') && sharedSupabase.includes('options.storageKey ? { storageKey: options.storageKey }'), 'Shared Supabase client must support an explicit isolated auth storage key.');
expect(adminSupabase.includes("ADMIN_AUTH_STORAGE_KEY = 'chonlove-admin-auth-v1'"), 'Admin must use a dedicated browser auth storage key rather than inherit the member session.');
expect(adminSupabase.includes('if (!url || !anonKey)') && adminSupabase.includes('cachedClient = null'), 'Admin client must remain fail-closed when non-production Supabase configuration is absent.');
expect(adminSupabase.includes('detectSessionInUrl: false') && adminSupabase.includes('storageKey: ADMIN_AUTH_STORAGE_KEY'), 'Admin auth client must ignore member/auth callback fragments and persist only in Admin storage.');
expect(adminGuard.includes('const [allowed, setAllowed] = useState(false)') && adminGuard.includes('const [checking, setChecking] = useState(true)'), 'Admin route guard must prerender fail-closed and never expose protected children before authorization.');
expect(adminGuard.includes("signOut({ scope: 'local' })") && adminGuard.includes('isCurrentUserSuperAdmin'), 'Unauthorized Admin sessions must be locally cleared after the live super_admin check.');
expect(adminProtectedLayout.includes('<AdminShell links={links}>{children}</AdminShell>'), 'Protected Admin routes must render inside the authenticated application shell using the guarded navigation source.');
expect(adminShell.includes("['Users', '/users']") && adminShell.includes('Đăng xuất') && adminShell.includes("signOut({ scope: 'local' })"), 'Admin shell must expose operational navigation and an isolated local sign-out action.');
expect(adminShellCss.includes('.adminShell') && adminShellCss.includes('.adminSidebar') && adminShellCss.includes('.adminMain>.card'), 'Admin shell stylesheet must style navigation and legacy operational cards; unstyled text-only Admin deploys are not acceptable.');

expect(!rootNetlify.includes('build:netlify:chon') && !rootNetlify.includes('apps/public-web/.next'), 'Root production must never fall back to the retired combined public-web build.');
expect(packageJson.scripts?.build === 'pnpm --filter @myfan/admin build && pnpm --filter @myfan/mobile build:web', 'Root build must compile Admin and the canonical Chon.Love Expo Web app only.');
expect(!packageJson.scripts?.['build:netlify:chon'], 'Retired combined Netlify build script must not be exposed by package.json.');
expect(packageJson.scripts?.['validate:netlify-release'] === 'node scripts/validate-br10.mjs', 'package.json must expose validate:netlify-release.');
expect(packageJson.scripts?.validate?.includes('validate:runtime-quality') && packageJson.scripts?.validate?.includes('validate:netlify-release'), 'Aggregate validation must include runtime quality and Netlify release checks.');
expect(!packageJson.scripts?.validate?.includes('validate:creator-e2e'), 'Retired Creator Activity must not be a release gate.');
expect(ci.includes('pnpm validate:netlify-release'), 'Application CI must run the canonical Netlify release validator.');

for (const path of [
  'docs/br-10/README.md',
  'docs/br-10/ACCEPTANCE.md',
  'docs/br-10/NETLIFY-RUNBOOK.md',
  'docs/br-10/STATUS.md',
]) {
  try { read(path); } catch { errors.push(`Missing BR-10 document: ${path}`); }
}

if (errors.length) {
  console.error('Chon.Love Netlify validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.warn('Chon.Love Netlify validation passed: Expo Web is canonical, /admin is isolated and fail-closed with styled static assets, production requires its public Supabase configuration, non-production previews can build without production data access, and versioned SEO assets use immutable caching.');
