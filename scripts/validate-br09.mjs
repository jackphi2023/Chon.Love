import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const packageJson = json('package.json');
const releaseManifest = json('config/releases/chon-web-v1.json');
const migration = read('supabase/migrations/20260801045034_br_09_runtime_observability_resilience.sql');
const dbTest = read('supabase/tests/br_09_runtime_observability_resilience.sql');
const runtime = read('packages/supabase/src/runtime-observability.ts');
const runtimeTest = read('packages/supabase/src/runtime-observability.test.ts');
const ui = read('packages/ui/src/index.ts');
const uiTest = read('packages/ui/src/index.test.ts');
const mobileProviders = read('apps/mobile/src/providers/app-providers.tsx');
const mobileBoundary = read('apps/mobile/src/components/app-error-boundary.tsx');
const mobileLogin = read('apps/mobile/app/(auth)/index.tsx');
const mobileHtml = read('apps/mobile/app/+html.tsx');
const mobileLayout = read('apps/mobile/app/_layout.tsx');
const adminLayout = read('apps/admin/app/layout.tsx');
const adminError = read('apps/admin/app/error.tsx');
const publicLayout = read('apps/public-web/app/layout.tsx');
const publicError = read('apps/public-web/app/error.tsx');
const edge = read('supabase/functions/runtime-observability-admin/index.ts');
const browser = read('tests/br-09/observability-accessibility-resilience.spec.mjs');
const browserWorkflow = read('.github/workflows/browser-e2e.yml');
const databaseWorkflow = read('.github/workflows/database.yml');
const ci = read('.github/workflows/ci.yml');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };
const htmlTitle = mobileHtml.match(/<title>([^<]+)<\/title>/)?.[1]?.trim();

expect(packageJson.scripts?.['validate:runtime-quality'] === 'node scripts/validate-br09.mjs', 'package.json must expose validate:runtime-quality.');
expect(packageJson.scripts?.validate?.includes('validate:kyc-withdrawal-operations') && packageJson.scripts?.validate?.includes('validate:runtime-quality'), 'Aggregate validation must preserve BR-08 and include BR-09.');
expect(ci.includes('pnpm validate:runtime-quality') && !ci.includes('br09-source-snapshot'), 'CI must run BR-09 without temporary snapshot jobs.');
expect(databaseWorkflow.includes('20260801045034_br_09_runtime_observability_resilience.sql') && databaseWorkflow.includes('Run BR-09 runtime observability resilience'), 'Database CI must inventory and run BR-09.');
expect(browserWorkflow.includes('playwright.br09.config.mjs') && browserWorkflow.includes('@axe-core/playwright'), 'Browser CI must run BR-09 accessibility and resilience checks.');

for (const token of ['private.runtime_observability_events','record_runtime_observability_event','admin_runtime_observability_snapshot','purge_expired_runtime_observability_events']) expect(migration.includes(token), `Migration must include ${token}.`);
expect(migration.includes("('runtime_observability_ingest_enabled','false'::jsonb"), 'Runtime ingestion must default to false.');
expect(!migration.includes("('runtime_observability_ingest_enabled','true'::jsonb"), 'Runtime ingestion must never default to true.');
expect(migration.includes('runtime_observability_events_are_immutable'), 'Runtime observations must be immutable.');
expect(migration.includes('runtime_observability_rate_limit_exceeded'), 'Ingest must be rate limited.');
expect(!migration.includes('grant usage on schema private') && !migration.includes('grant select on private.') && !migration.includes('grant all'), 'BR-09 must not expose private tables.');
for (const forbidden of ['access_token','refresh_token','purchase_token','password','legal_name','account_number_ciphertext','latitude','longitude','message_body']) {
  expect(!migration.includes(`'${forbidden}'`), `Migration telemetry allowlist must not contain ${forbidden}.`);
}

expect(dbTest.includes('select plan(32);') && dbTest.toLowerCase().includes('rollback;'), 'BR-09 pgTAP must declare 32 rollback-isolated assertions.');
for (const assertion of ['observation ingestion fails closed while disabled','sensitive telemetry keys are rejected before storage','per-user rate limit fails closed','runtime observations cannot be updated','retention cleanup removes expired observations']) expect(dbTest.includes(assertion), `Database test must cover ${assertion}.`);

for (const operation of ["operationClass === 'financial'", "operationClass === 'non_idempotent_write'", "operationClass === 'auth'"]) expect(runtime.includes(operation), `Retry policy must fail closed for ${operation}.`);
expect(runtime.includes('failureCount >= 2') && runtimeTest.includes('at most twice'), 'Read retries must be bounded to two failures.');
expect(runtime.includes('FORBIDDEN_TELEMETRY_KEY') && runtime.includes('ALLOWED_METADATA_KEYS'), 'Telemetry metadata must be allowlisted and sensitive-key filtered.');
expect(mobileProviders.includes('mutations:') && mobileProviders.includes('retry: false'), 'Mobile mutations must never auto-retry.');
expect(mobileBoundary.includes('accessibilityRole="alert"') && mobileBoundary.includes('route_recovered'), 'Mobile error boundary must be accessible and report recovery.');
expect(mobileLogin.includes('accessibilityLabel="Email"') && mobileLogin.includes('accessibilityLabel="Mật khẩu"'), 'Mobile login fields require accessible names.');
expect(mobileHtml.includes('<html lang="vi">') && Boolean(htmlTitle), 'Expo Web export shell must publish Vietnamese language metadata and a non-empty document title.');
expect(mobileLayout.includes("document.documentElement.lang = 'vi'") && mobileLayout.includes('document.title = WEB_TITLE'), 'Expo Web runtime must restore document language and title in development previews.');
expect(ui.includes('minimumTouchTarget: 44') && ui.includes('contrastRatio') && uiTest.includes('WCAG AA'), 'Shared UI must enforce touch and contrast contracts.');
expect(adminLayout.includes('skipLink') && publicLayout.includes('skipLink'), 'Admin and Public Web need skip links.');
expect(adminError.includes('tabIndex={-1}') && publicError.includes('tabIndex={-1}'), 'Web error boundaries must move focus to their heading.');
expect(edge.includes("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')") && edge.includes('server.auth.getUser(authorization.slice(7))'), 'Admin observability Edge Function must keep service role server-side and validate JWT.');
expect(!edge.includes('console.error(error') && !edge.includes('console.log(body') && !edge.includes('console.error(body'), 'Edge logs must not include raw errors or request bodies.');
expect(browser.includes('AxeBuilder') && browser.includes('tokenRequests).toBe(1)') && browser.includes('toBeGreaterThanOrEqual(44)'), 'Browser E2E must cover axe, touch targets, and no mutation retry.');
expect(browser.includes('toHaveTitle') && browser.includes("toHaveAttribute('lang', 'vi')"), 'Browser E2E must verify document title and language metadata.');

for (const forbidden of ['myfan1@gmail.com','myfan16@gmail.com','MYFAN_E2E_BETA_PASSWORD']) {
  expect(!migration.includes(forbidden) && !dbTest.includes(forbidden) && !edge.includes(forbidden) && !browser.includes(forbidden), `BR-09 must not contain ${forbidden}.`);
}
expect(releaseManifest.financialFeaturesEnabled === false, 'Financial features must remain disabled.');
expect(releaseManifest.mergeAllowed === false && releaseManifest.productionDeployAllowed === false, 'BR-09 must not authorize merge or production deploy.');
for (const path of ['docs/br-09/README.md','docs/br-09/TEST-MATRIX.md','docs/br-09/ACCEPTANCE.md','docs/br-09/STATUS.md','docs/br-09/IMPLEMENTATION-HEAD.md']) {
  try { read(path); } catch { errors.push(`Missing BR-09 document: ${path}`); }
}
if (errors.length) { console.error('BR-09 validation failed:'); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.warn('BR-09 observability, accessibility, and resilience source validation passed.');
