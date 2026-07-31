import { readFileSync } from 'node:fs';

const readText = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readJson = (path) => JSON.parse(readText(path));
const packageJson = readJson('package.json');
const releaseManifest = readJson('config/releases/beta-mobile-web.json');
const migration = readText('supabase/migrations/20260731192600_br_08_kyc_withdrawal_operational_flow.sql');
const databaseTest = readText('supabase/tests/br_08_kyc_withdrawal_operational_flow.sql');
const edgeFunction = readText('supabase/functions/payout-admin/index.ts');
const sharedClient = readText('packages/supabase/src/kyc-withdrawal-operations.ts');
const sharedTest = readText('packages/supabase/src/kyc-withdrawal-operations.test.ts');
const sharedIndex = readText('packages/supabase/src/index.ts');
const adminPage = readText('apps/admin/app/kyc-withdrawal-operations/kyc-withdrawal-operations-client.tsx');
const adminLogin = readText('apps/admin/app/admin-login.tsx');
const applicationCi = readText('.github/workflows/ci.yml');
const databaseCi = readText('.github/workflows/database.yml');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

expect(packageJson.scripts?.['validate:kyc-withdrawal-operations'] === 'node scripts/validate-br08.mjs', 'package.json must expose validate:kyc-withdrawal-operations.');
expect(packageJson.scripts?.validate?.includes('validate:vietqr-reconciliation') && packageJson.scripts?.validate?.includes('validate:kyc-withdrawal-operations'), 'Aggregate validation must preserve BR-07 and include BR-08.');
expect(applicationCi.includes('pnpm validate:kyc-withdrawal-operations'), 'Application CI must run the BR-08 source guard.');
expect(databaseCi.includes('br_08_kyc_withdrawal_operational_flow.sql') && databaseCi.includes('Run BR-08 KYC and withdrawal operational flow'), 'Database CI must inventory and execute BR-08.');

for (const object of [
  'private.payout_operation_events',
  'public.admin_list_kyc_operational_queue',
  'public.admin_list_bank_operational_queue',
  'public.admin_list_withdrawal_operational_queue',
  'public.admin_start_kyc_review',
  'public.admin_start_bank_review',
  'public.admin_start_withdrawal_review',
  'public.admin_operate_withdrawal',
]) expect(migration.includes(object), `Migration must define ${object}.`);

for (const flag of [
  'kyc_operational_review_enabled',
  'bank_account_operational_review_enabled',
  'withdrawal_requests_enabled',
  'withdrawal_operational_review_enabled',
  'withdrawal_processing_enabled',
  'withdrawal_payout_enabled',
]) {
  expect(migration.includes(`('${flag}','false'::jsonb`), `${flag} must default to false.`);
  expect(!migration.includes(`('${flag}','true'::jsonb`), `${flag} must never default to true.`);
}
expect(migration.includes("array['finance_admin','super_admin']::private.user_role[]"), 'Operational RPCs must require finance_admin or super_admin.');
expect(migration.includes('withdrawal_dual_control_required'), 'Withdrawal payout must enforce maker-checker control.');
expect(migration.includes('payment_evidence_sha256_required'), 'Manual payout must require payment evidence SHA-256.');
expect(migration.includes('payout_operation_events_are_immutable'), 'Operational event ledger must be immutable.');
expect(migration.includes("raise exception using errcode='23505',message='request_id_conflict'"), 'Idempotency conflicts must fail closed.');
expect(migration.includes('revoke execute on function public.request_withdrawal') && migration.includes('from public,anon,authenticated'), 'Authenticated withdrawal requests must remain disabled.');
expect(migration.includes('revoke execute on function public.prepare_kyc_document_upload') && migration.includes('revoke execute on function public.finalize_kyc_document_upload'), 'KYC upload must remain disabled for Beta clients.');
expect(migration.includes('revoke execute on function public.admin_decide_withdrawal') && migration.includes('service_role'), 'Legacy single-control withdrawal decision must be revoked.');
expect(!migration.includes('grant usage on schema private') && !migration.includes('grant select on private.') && !migration.includes('grant all'), 'BR-08 must not expose private schema or tables.');

expect(databaseTest.includes('select plan(47);'), 'BR-08 pgTAP contract must declare 47 assertions.');
for (const assertion of [
  'KYC review is disabled by default',
  'withdrawal requests are disabled by default',
  'legacy single-control withdrawal decision is revoked',
  'a different finance operator cannot view assigned KYC PII',
  'the approving operator cannot start payout processing',
  'payout recording fails closed while disabled',
  'marking paid requires payment evidence hash',
  'second finance operator records verified manual payout',
  'idempotent payout retry does not duplicate reward ledger entries',
  'payout operation events cannot be deleted',
  'rollback;',
]) expect(databaseTest.includes(assertion), `Database contract must cover: ${assertion}.`);
for (const forbidden of ['myfan1@gmail.com', 'myfan16@gmail.com', 'MYFAN_E2E_BETA_PASSWORD']) {
  expect(!databaseTest.includes(forbidden) && !edgeFunction.includes(forbidden), `BR-08 must not contain ${forbidden}.`);
}

expect(edgeFunction.includes("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')"), 'Payout Admin must keep service role server-side.');
expect(edgeFunction.includes("action === 'operate_withdrawal'"), 'Payout Admin must expose the BR-08 withdrawal operation route.');
expect(edgeFunction.includes("action === 'list_kyc_queue'") && edgeFunction.includes("action === 'start_withdrawal_review'"), 'Payout Admin must expose operational queues and assignment.');
expect(!edgeFunction.includes("server.rpc('admin_decide_withdrawal'"), 'Payout Admin must not call the legacy single-control withdrawal RPC.');
expect(edgeFunction.includes("server.auth.getUser(authorization.slice(7))"), 'Payout Admin must validate the caller JWT.');

expect(sharedIndex.includes("export * from './kyc-withdrawal-operations';"), 'Shared Supabase entry point must export BR-08.');
for (const token of ['listPayoutOperationalQueue','startPayoutOperationalReview','getKycReviewPayload','getBankReviewPayload','getKycDocumentAccess','operateWithdrawal','mark_paid']) {
  expect(sharedClient.includes(token) || sharedTest.includes(token), `Shared BR-08 contract must include ${token}.`);
}
expect(adminPage.includes('COMPLIANCE · FINANCE · BR-08'), 'Admin page must identify BR-08.');
expect(adminPage.includes('maker–checker') && adminPage.includes('SHA-256'), 'Admin page must explain dual control and payment evidence.');
expect(adminLogin.includes('href="/kyc-withdrawal-operations"'), 'Admin home must link to BR-08 operations.');
expect(releaseManifest.financialFeaturesEnabled === false, 'Financial release flag must remain disabled.');
expect(releaseManifest.mergeAllowed === false, 'BR-08 must not authorize merge.');
expect(releaseManifest.productionDeployAllowed === false, 'BR-08 must not authorize production deployment.');

for (const path of ['docs/br-08/README.md','docs/br-08/TEST-MATRIX.md','docs/br-08/ACCEPTANCE.md','docs/br-08/STATUS.md','docs/br-08/IMPLEMENTATION-HEAD.md']) {
  try { readText(path); } catch { errors.push(`Missing BR-08 document: ${path}`); }
}
if (errors.length) {
  console.error('BR-08 validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.warn('BR-08 KYC and withdrawal operational source validation passed.');
console.warn('Coverage: disabled-by-default KYC/bank/withdrawal controls, assignment, audited PII access, maker-checker payout, payment evidence, immutable events, and no client payout path.');
