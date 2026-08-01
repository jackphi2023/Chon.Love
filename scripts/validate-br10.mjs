import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const appConfig = json('apps/mobile/app.json');
const packageJson = json('package.json');
const redirects = read('apps/mobile/public/_redirects');
const netlify = read('apps/mobile/netlify.toml');
const ci = read('.github/workflows/ci.yml');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

expect(appConfig.expo?.web?.bundler === 'metro', 'Mobile Web must keep the Metro bundler.');
expect(appConfig.expo?.web?.output === 'single', 'Mobile Web must export as a single-page application for dynamic authenticated routes.');
expect(/^\/\*\s+\/index\.html\s+200\s*$/mu.test(redirects), 'Netlify SPA fallback must rewrite every route to /index.html with status 200.');
expect(netlify.includes('command = "corepack enable && pnpm --filter @myfan/mobile build:web"'), 'Netlify must build the Mobile workspace from the monorepo root.');
expect(netlify.includes('publish = "apps/mobile/dist"'), 'Netlify publish directory must be apps/mobile/dist relative to the repository root.');
expect(netlify.includes('NODE_VERSION = "22.13.0"') && netlify.includes('PNPM_VERSION = "10.15.1"'), 'Netlify Node and pnpm versions must match repository engines.');
expect(netlify.includes('[context.production.environment]') && netlify.includes('EXPO_PUBLIC_MYFAN_ENV = "production"'), 'Production deploys must use the production environment contract.');
expect(netlify.includes('[context.deploy-preview.environment]') && netlify.includes('[context.branch-deploy.environment]'), 'Deploy Preview and branch deploy contexts must be explicit.');
for (const flag of [
  'EXPO_PUBLIC_FEATURE_GOOGLE_PLAY_BILLING',
  'EXPO_PUBLIC_FEATURE_SEND_GIFT',
  'EXPO_PUBLIC_FEATURE_CREATOR_WALLET',
  'EXPO_PUBLIC_FEATURE_CREATOR_KYC',
  'EXPO_PUBLIC_FEATURE_WITHDRAWAL',
]) {
  expect(netlify.includes(`${flag} = "false"`), `${flag} must remain disabled for BR-10.`);
}
expect(!netlify.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Netlify frontend configuration must never contain a service-role key.');
expect(!netlify.includes('MYFAN_PII_ENCRYPTION_KEY_B64'), 'Netlify frontend configuration must never contain the PII encryption key.');
expect(!/EXPO_PUBLIC_SUPABASE_ANON_KEY\s*=\s*"[^\"]+"/u.test(netlify), 'The Supabase publishable key must be configured in Netlify UI, not committed.');
expect(netlify.includes('X-Content-Type-Options = "nosniff"') && netlify.includes('X-Frame-Options = "DENY"'), 'Netlify baseline security headers must remain enabled.');
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
console.warn('BR-10 Netlify Mobile Web release source validation passed.');
