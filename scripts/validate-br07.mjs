import { readFileSync } from 'node:fs';

const readText = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readJson = (path) => JSON.parse(readText(path));

const packageJson = readJson('package.json');
const releaseManifest = readJson('config/releases/chon-web-v1.json');
const migration = readText('supabase/migrations/20260731185855_br_07_vietqr_reconciliation_mvp.sql');
const databaseTest = readText('supabase/tests/br_07_vietqr_reconciliation_mvp.sql');
const edgeFunction = readText('supabase/functions/vietqr-reconciliation-admin/index.ts');
const supabaseConfig = readText('supabase/config.toml');
const sharedClient = readText('packages/supabase/src/vietqr-reconciliation.ts');
const sharedClientTest = readText('packages/supabase/src/vietqr-reconciliation.test.ts');
const sharedIndex = readText('packages/supabase/src/index.ts');
const adminPage = readText('apps/admin/app/vietqr-reconciliation/vietqr-reconciliation-client.tsx');
const adminNavigation = readText('apps/admin/app/(protected)/layout.tsx');
const applicationCi = readText('.github/workflows/ci.yml');
const databaseCi = readText('.github/workflows/database.yml');

const errors = [];
const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

expect(
  packageJson.scripts?.['validate:vietqr-reconciliation'] === 'node scripts/validate-br07.mjs',
  'package.json must expose validate:vietqr-reconciliation.',
);
expect(
  packageJson.scripts?.validate?.includes('validate:browser-e2e') &&
    packageJson.scripts?.validate?.includes('validate:vietqr-reconciliation'),
  'The aggregate validate command must preserve BR-06 and include BR-07.',
);
expect(applicationCi.includes('pnpm validate:vietqr-reconciliation'), 'Application CI must execute the BR-07 source guard.');
expect(
  databaseCi.includes('br_07_vietqr_reconciliation_mvp.sql') &&
    databaseCi.includes('Run BR-07 VietQR reconciliation MVP'),
  'Database CI must inventory and execute the BR-07 pgTAP contract.',
);

for (const object of [
  'private.vietqr_bank_transactions',
  'private.vietqr_reconciliation_events',
  'private.vietqr_reconciliation_state',
  'public.admin_import_vietqr_bank_transaction',
  'public.admin_list_vietqr_reconciliation_queue',
  'public.admin_decide_vietqr_reconciliation',
]) {
  expect(migration.includes(object), `BR-07 migration must define ${object}.`);
}

for (const flag of [
  'vietqr_reconciliation_enabled',
  'vietqr_manual_settlement_enabled',
  'vietqr_auto_settlement_enabled',
  'vietqr_web_payments_enabled',
]) {
  expect(migration.includes(flag), `BR-07 migration must control ${flag}.`);
}
expect(
  migration.includes("('vietqr_reconciliation_enabled','false'::jsonb") &&
    migration.includes("('vietqr_manual_settlement_enabled','false'::jsonb") &&
    migration.includes("('vietqr_auto_settlement_enabled','false'::jsonb") &&
    migration.includes("where key='vietqr_web_payments_enabled'"),
  'All VietQR import, settlement, automatic settlement, and web order paths must default to disabled.',
);
expect(
  migration.includes("if coalesce(private.config_boolean('vietqr_reconciliation_enabled'),false) is not true") &&
    migration.includes("if coalesce(private.config_boolean('vietqr_manual_settlement_enabled'),false) is not true"),
  'Import and settlement RPCs must enforce database feature flags.',
);
expect(
  migration.includes("array['finance_admin','super_admin']::private.user_role[]"),
  'VietQR reconciliation must require finance_admin or super_admin.',
);
expect(
  migration.includes('unique(provider, provider_transaction_ref)') &&
    migration.includes('import_request_id uuid not null unique') &&
    migration.includes('request_id uuid not null unique'),
  'BR-07 must enforce provider, import, and decision idempotency.',
);
expect(
  migration.includes('vietqr_reconciliation_events_immutable') &&
    migration.includes('vietqr_reconciliation_events_are_immutable'),
  'Reconciliation events must be immutable.',
);
expect(
  migration.includes('revoke execute on function public.record_verified_vietqr_payment') &&
    migration.includes('revoke execute on function public.create_vietqr_heart_order') &&
    migration.includes('revoke execute on function public.list_vietqr_heart_products'),
  'Direct heart credit and user-facing VietQR order RPCs must be revoked.',
);
expect(
  migration.includes('grant execute on function public.admin_import_vietqr_bank_transaction') &&
    migration.includes('to service_role;'),
  'Only the server-side admin path may call reconciliation RPCs.',
);
expect(
  !migration.includes('grant usage on schema private') &&
    !migration.includes('grant select on private.') &&
    !migration.includes('grant all'),
  'BR-07 must not reopen private schema or table access.',
);
expect(
  migration.includes("('vietqr_auto_settlement_enabled','false'::jsonb") &&
    !migration.includes("('vietqr_auto_settlement_enabled','true'::jsonb"),
  'Automatic settlement must remain disabled.',
);

expect(databaseTest.includes('select plan(34);'), 'BR-07 pgTAP contract must declare 34 assertions.');
for (const assertion of [
  'reconciliation is disabled by default',
  'manual settlement is disabled by default',
  'automatic settlement remains disabled',
  'service role cannot bypass reconciliation to credit hearts directly',
  'only finance_admin or super_admin can import reconciliation rows',
  'exact token and amount are classified as matched',
  'amount mismatch is routed to manual review',
  'manual settlement fails closed while disabled',
  'settlement credits the exact heart units once',
  'idempotent retry does not duplicate the heart ledger credit',
  'reconciliation events cannot be deleted',
  'rollback;',
]) {
  expect(databaseTest.includes(assertion), `BR-07 database contract must cover: ${assertion}.`);
}
for (const forbidden of ['myfan1@gmail.com', 'myfan16@gmail.com', 'MYFAN_E2E_BETA_PASSWORD']) {
  expect(!databaseTest.includes(forbidden), `BR-07 test must not contain ${forbidden}.`);
}

expect(supabaseConfig.includes('[functions.vietqr-reconciliation-admin]'), 'Supabase config must register the BR-07 Edge Function.');
expect(supabaseConfig.includes('verify_jwt = true'), 'The BR-07 Edge Function must require JWT verification.');
expect(edgeFunction.includes("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')"), 'Server function must obtain service role only from server environment.');
expect(!edgeFunction.includes("'Access-Control-Allow-Origin': 'http"), 'CORS must not hard-code an unsafe development origin.');
expect(edgeFunction.includes("body.action === 'import'") && edgeFunction.includes("body.action === 'decide'"), 'Edge Function must expose import and audited decision actions.');
expect(!edgeFunction.includes('record_verified_vietqr_payment'), 'Edge Function must not call the direct credit RPC.');
expect(!edgeFunction.includes('create_vietqr_heart_order'), 'Edge Function must not create user VietQR orders.');

expect(sharedIndex.includes("export * from './vietqr-reconciliation';"), 'Shared Supabase entry point must export BR-07.');
for (const token of [
  'listVietqrReconciliationQueue',
  'importVietqrBankTransaction',
  'decideVietqrReconciliation',
  'vietqrReconciliationDecisionSchema',
  "'auto_settle'",
]) {
  expect(sharedClient.includes(token) || sharedClientTest.includes(token), `BR-07 shared client contract must include ${token}.`);
}
expect(adminPage.includes('FINANCE CONTROL · BR-07'), 'Admin page must identify the BR-07 finance control scope.');
expect(adminPage.includes('Import vào inbox'), 'Admin page must support manual bank transaction import.');
expect(adminPage.includes('Xác nhận ghi có'), 'Admin page must make settlement an explicit action.');
expect(adminPage.includes('Fail closed:'), 'Admin page must explain fail-closed settlement controls.');
expect(adminNavigation.includes("'/vietqr-reconciliation'"), 'Protected Admin navigation must link to VietQR reconciliation.');

expect(releaseManifest.financialFeaturesEnabled === false, 'Financial feature flags must remain disabled.');
expect(releaseManifest.mergeAllowed === false, 'BR-07 must not authorize merge.');
expect(releaseManifest.productionDeployAllowed === false, 'BR-07 must not authorize production deployment.');

for (const path of [
  'docs/br-07/README.md',
  'docs/br-07/TEST-MATRIX.md',
  'docs/br-07/ACCEPTANCE.md',
  'docs/br-07/STATUS.md',
  'docs/br-07/IMPLEMENTATION-HEAD.md',
]) {
  try {
    readText(path);
  } catch {
    errors.push(`Missing required BR-07 document: ${path}`);
  }
}

if (errors.length > 0) {
  console.error('BR-07 VietQR reconciliation validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.warn('BR-07 VietQR reconciliation MVP source validation passed.');
console.warn('Coverage: disabled-by-default flags, finance-only import, deterministic matching, manual review, audited idempotent settlement, immutable events, and no direct client credit path.');
