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
  expect(netlify.includes('for = "/admin/*"') && netlify.includes('X-Robots-Tag = "noindex, nofollow, noarchive"'), `${label} Admin routes must be no-store/noindex.`);
}

expect(netlifyBuildScript.includes('pnpm --filter @myfan/mobile build:web'), 'Combined Netlify build must compile canonical Mobile Web.');
expect(netlifyBuildScript.includes('pnpm --filter @myfan/admin build'), 'Combined Netlify build must compile Admin.');
expect(netlifyBuildScript.includes('cp -R apps/admin/out/. apps/mobile/dist/admin/'), 'Combined Netlify build must mount Admin output below /admin.');
expect(netlifyBuildScript.includes('apps/mobile/dist/admin/login/index.html') && netlifyBuildScript.includes('apps/mobile/dist/admin/users/index.html'), 'Combined Netlify build must fail closed if core Admin routes are missing.');
expect(!netlifyBuildScript.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Combined Netlify build must never require a service-role key.');

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
console.warn('Chon.Love Netlify validation passed: Expo Web is canonical, /admin is mounted in the same artifact, and non-production deploys are not hard-wired to production data.');
