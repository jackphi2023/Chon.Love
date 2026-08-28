import { readFileSync } from 'node:fs';

const readText = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readJson = (path) => JSON.parse(readText(path));
const packageJson = readJson('package.json');
const releaseManifest = readJson('config/releases/chon-web-v1.json');
const migration = readText('supabase/migrations/20260731205924_br_08_kyc_withdrawal_operational_flow.sql');
const opt12Migration = readText('supabase/migrations/20260828081500_opt_12_user_withdrawal_enable.sql');
const databaseTest = readText('supabase/tests/br_08_kyc_withdrawal_operational_flow.sql');
const edgeFunction = readText('supabase/functions/payout-admin/index.ts');
const sharedClient = readText('packages/supabase/src/kyc-withdrawal-operations.ts');
const sharedTest = readText('packages/supabase/src/kyc-withdrawal-operations.test.ts');
const withdrawalClient = readText('packages/supabase/src/withdrawal.ts');
const withdrawalPanel = readText('apps/mobile/src/components/chon-withdrawal-panel.tsx');
const withdrawalPage = readText('apps/mobile/app/withdrawal.tsx');
const sharedIndex = readText('packages/supabase/src/index.ts');
const adminPage = readText('apps/admin/app/kyc-withdrawal-operations/kyc-withdrawal-operations-client.tsx');
const withdrawalsPage = readText('apps/admin/app/(protected)/withdrawals/page.tsx');
const legacyOperationsPage = readText('apps/admin/app/kyc-withdrawal-operations/page.tsx');
const adminNavigation = readText('apps/admin/app/(protected)/layout.tsx');
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
  expect(migration.includes(`('${flag}','false'::jsonb`), `${flag} must default to false in the BR-08 baseline.`);
  expect(!migration.includes(`('${flag}','true'::jsonb`), `${flag} must not default to true in the BR-08 baseline.`);
}
expect(migration.includes("array['finance_admin','super_admin']::private.user_role[]"), 'Operational RPCs must require finance_admin or super_admin.');
expect(migration.includes('withdrawal_dual_control_required'), 'Withdrawal payout must enforce maker-checker control.');
expect(migration.includes('payment_evidence_sha256_required'), 'Manual payout must require payment evidence SHA-256.');
expect(migration.includes('payout_operation_events_are_immutable'), 'Operational event ledger must be immutable.');
expect(migration.includes("raise exception using errcode='23505',message='request_id_conflict'"), 'Idempotency conflicts must fail closed.');
expect(migration.includes('revoke execute on function public.request_withdrawal') && migration.includes('from public,anon,authenticated'), 'BR-08 baseline must originally fail closed for client withdrawal requests.');
expect(migration.includes('revoke execute on function public.prepare_kyc_document_upload') && migration.includes('revoke execute on function public.finalize_kyc_document_upload'), 'KYC upload must remain disabled for Beta clients.');
expect(migration.includes('revoke execute on function public.admin_decide_withdrawal') && migration.includes('service_role'), 'Legacy single-control withdrawal decision must be revoked.');
expect(!migration.includes('grant usage on schema private') && !migration.includes('grant select on private.') && !migration.includes('grant all'), 'BR-08 must not expose private schema or tables.');

expect(opt12Migration.includes("'withdrawal_requests_enabled'"), 'OPT-12 must explicitly own the withdrawal request release flag.');
expect(opt12Migration.includes("'true'::jsonb"), 'OPT-12 must intentionally enable user withdrawal requests.');
expect(opt12Migration.includes("private.require_boolean_config('withdrawal_requests_enabled')"), 'OPT-12 request RPC must retain a fail-closed emergency switch.');
expect(opt12Migration.includes('grant execute on function public.request_withdrawal(uuid,bigint,uuid) to authenticated,service_role'), 'OPT-12 must intentionally grant only the guarded request RPC to authenticated users and service role.');
expect(opt12Migration.includes('approved_kyc_required') && opt12Migration.includes('verified_bank_account_required') && opt12Migration.includes('withdrawal_blocked_by_hold'), 'OPT-12 must preserve KYC, verified-bank and financial-hold gates.');
expect(opt12Migration.includes('withdrawal_below_minimum') && opt12Migration.includes('insufficient_recipient_available_balance'), 'OPT-12 must preserve minimum and available-balance checks.');
expect(opt12Migration.includes("'withdrawal_hold'") && opt12Migration.includes('withdrawal_reward_allocations'), 'OPT-12 must preserve atomic reward allocation and hold ledger accounting.');
expect(!opt12Migration.includes('grant usage on schema private') && !opt12Migration.includes('grant select on private.'), 'OPT-12 must not expose private schema data to the client.');

expect(databaseTest.includes('select plan(47);'), 'BR-08 pgTAP contract must declare 47 assertions.');
for (const assertion of [
  'KYC review is disabled by default',
  'withdrawal requests are enabled for OPT-12 user flow',
  'authenticated users can request withdrawals after OPT-12 release',
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
expect(sharedIndex.includes("export * from './withdrawal';"), 'Shared Supabase entry point must export OPT-12 user withdrawals.');
for (const token of ['listPayoutOperationalQueue','startPayoutOperationalReview','getKycReviewPayload','getBankReviewPayload','getKycDocumentAccess','operateWithdrawal','mark_paid']) {
  expect(sharedClient.includes(token) || sharedTest.includes(token), `Shared BR-08 contract must include ${token}.`);
}
for (const token of ['listMyPayoutBankAccounts','listMyWithdrawals','requestMyWithdrawal','cancelMyWithdrawal','submitMyPayoutBankAccount']) {
  expect(withdrawalClient.includes(token), `OPT-12 shared client must include ${token}.`);
}
expect(withdrawalPanel.includes('withdrawal_ready') && withdrawalPanel.includes('minimum_withdrawal_units'), 'OPT-12 UI must derive readiness and minimum from the server wallet contract.');
expect(withdrawalPanel.includes('Gửi yêu cầu rút tiền') && withdrawalPanel.includes('Lịch sử rút tiền'), 'OPT-12 UI must expose request and history surfaces.');
expect(withdrawalPage.includes('ChonWithdrawalPanel'), 'OPT-12 must expose a canonical authenticated withdrawal page.');

expect(adminPage.includes('COMPLIANCE · FINANCE · BR-08'), 'Admin page must identify BR-08.');
expect(adminPage.includes('maker–checker') && adminPage.includes('SHA-256'), 'Admin page must explain dual control and payment evidence.');
expect(withdrawalsPage.includes('KycWithdrawalOperationsClient'), 'Canonical /withdrawals Admin route must render the real BR-08 operational client instead of a placeholder.');
expect(withdrawalsPage.includes('Chon.Love Admin'), 'Canonical withdrawal route metadata must use Chon.Love branding.');
expect(legacyOperationsPage.includes('KycWithdrawalOperationsClient'), 'Legacy BR-08 route must remain a functional compatibility route.');
expect(!legacyOperationsPage.includes('Luxy.Love Admin'), 'Legacy BR-08 route must not expose stale Luxy.Love branding.');
expect(adminNavigation.includes("['KYC & rút tiền', '/withdrawals']"), 'Protected Admin navigation must link to canonical /withdrawals operations.');
expect(!adminNavigation.includes("['Withdrawals', '/withdrawals']") && !adminNavigation.includes("['KYC & rút tiền', '/kyc-withdrawal-operations']"), 'Protected Admin navigation must not expose duplicate withdrawal routes.');
expect(releaseManifest.financialFeaturesEnabled === false, 'Release manifest financial flag remains a production deployment boundary; OPT-12 does not authorize deployment by itself.');
expect(releaseManifest.mergeAllowed === false, 'BR-08/OPT-12 must not authorize merge.');
expect(releaseManifest.productionDeployAllowed === false, 'BR-08/OPT-12 must not authorize production deployment.');

for (const path of ['docs/br-08/README.md','docs/br-08/TEST-MATRIX.md','docs/br-08/ACCEPTANCE.md','docs/br-08/STATUS.md','docs/br-08/IMPLEMENTATION-HEAD.md']) {
  try { readText(path); } catch { errors.push(`Missing BR-08 document: ${path}`); }
}
if (errors.length) {
  console.error('BR-08 / OPT-12 validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.warn('BR-08 + OPT-12 KYC and withdrawal source validation passed.');
console.warn('Coverage: BR-08 operational controls remain fail-closed; OPT-12 intentionally opens only guarded user withdrawal requests with KYC, verified-bank, hold, balance and immutable-ledger protections.');
