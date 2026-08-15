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
const ci = read('.github/workflows/ci.yml');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

expect(appConfig.expo?.web?.bundler === 'metro', 'Mobile Web must keep the Metro bundler.');
expect(appConfig.expo?.web?.output === 'single', 'Mobile Web must export as a single-page application for dynamic authenticated routes.');
expect(/^\/\*\s+\/index\.html\s+200\s*$/mu.test(redirects), 'Netlify SPA fallback must rewrite every route to /index.html with status 200.');

for (const [label, netlify] of [['root', rootNetlify], ['apps/mobile', mobileNetlify]]) {
  expect(
    netlify.includes('pnpm --filter @myfan/mobile build:web'),
    `${label} Netlify configuration must build the Mobile workspace.`,
  );
  expect(
    netlify.includes('publish = "apps/mobile/dist"'),
    `${label} Netlify publish directory must be apps/mobile/dist relative to repository root.`,
  );
  expect(
    Boolean(nodeVersion)
      && Boolean(pnpmVersion)
      && netlify.includes(`NODE_VERSION = "${nodeVersion}"`)
      && netlify.includes(`PNPM_VERSION = "${pnpmVersion}"`),
    `${label} Netlify Node and pnpm versions must match repository pins.`,
  );
  expect(
    netlify.includes('[context.production.environment]') && netlify.includes('EXPO_PUBLIC_MYFAN_ENV = "production"'),
    `${label} production deploys must use the production environment contract.`,
  );
  expect(
    netlify.includes('[context.deploy-preview.environment]') && netlify.includes('[context.branch-deploy.environment]'),
    `${label} Deploy Preview and branch deploy contexts must be explicit.`,
  );
  for (const flag of [
    'EXPO_PUBLIC_FEATURE_GOOGLE_PLAY_BILLING',
    'EXPO_PUBLIC_FEATURE_SEND_GIFT',
    'EXPO_PUBLIC_FEATURE_CREATOR_WALLET',
    'EXPO_PUBLIC_FEATURE_CREATOR_KYC',
    'EXPO_PUBLIC_FEATURE_WITHDRAWAL',
  ]) {
    expect(netlify.includes(`${flag} = "false"`), `${label}: ${flag} must remain disabled for BR-10.`);
  }
  expect(!netlify.includes('SUPABASE_SERVICE_ROLE_KEY'), `${label} frontend configuration must never contain a service-role key.`);
  expect(!netlify.includes('MYFAN_PII_ENCRYPTION_KEY_B64'), `${label} frontend configuration must never contain the PII encryption key.`);
  expect(!/EXPO_PUBLIC_SUPABASE_ANON_KEY\s*=\s*"[^"]+"/u.test(netlify), `${label}: Supabase publishable key must be configured in Netlify UI, not committed.`);
  expect(netlify.includes('X-Content-Type-Options = "nosniff"') && netlify.includes('X-Frame-Options = "DENY"'), `${label} Netlify baseline security headers must remain enabled.`);
}

expect(
  rootNetlify.includes('corepack enable && pnpm --filter @myfan/mobile build:web'),
  'Repository-root Netlify configuration must be the canonical Chon.Love production build for Base directory /.',
);
expect(
  !rootNetlify.includes('build:netlify:chon') && !rootNetlify.includes('apps/public-web/.next'),
  'Repository-root Netlify production must not fall back to the retired public-web homepage build.',
);
expect(packageJson.scripts?.['validate:netlify-release'] === 'node scripts/validate-br10.mjs', 'package.json must expose validate:netlify-release.');
expect(packageJson.scripts?.validate?.includes('validate:runtime-quality') && packageJson.scripts?.validate?.includes('validate:netlify-release'), 'Aggregate validation must preserve BR-09 and include BR-10.');
expect(ci.includes('pnpm validate:netlify-release'), 'Application CI must run the BR-10 Netlify release validator.');
for (const path of [
  'docs/br-10/README.md',
  'docs/br-10/ACCEPTANCE.md',
  'docs/br-10/NETLIFY-RUNBOOK.md',
  'docs/br-10/STATUS.md',
]) {
  try { read(path); } catch { errors.push(`Missing BR-10 document: ${path}`); }
}

if (errors.length) {
  console.error('BR-10 validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.warn('BR-10 Netlify Mobile Web release source validation passed: root and app-local configs both deploy the rebuilt Chon.Love Expo web app.');
