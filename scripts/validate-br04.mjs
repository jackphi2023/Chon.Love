import { readFileSync } from 'node:fs';

const readText = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readJson = (path) => JSON.parse(readText(path));

const packageJson = readJson('package.json');
const releaseManifest = readJson('config/releases/beta-mobile-web.json');
const applicationCi = readText('.github/workflows/ci.yml');
const databaseCi = readText('.github/workflows/database.yml');
const e2e = readText('supabase/tests/br_04_core_social_multi_account_e2e.sql');

const errors = [];
const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

expect(
  packageJson.scripts?.['validate:social-e2e'] === 'node scripts/validate-br04.mjs',
  'package.json must expose validate:social-e2e.',
);
expect(
  packageJson.scripts?.validate?.includes('validate:auth') &&
    packageJson.scripts?.validate?.includes('validate:social-e2e'),
  'The aggregate validate command must preserve BR-03 and include BR-04 validation.',
);
expect(
  applicationCi.includes('pnpm validate:social-e2e'),
  'Application CI must execute BR-04 social E2E source validation.',
);
expect(
  databaseCi.includes('supabase/tests/br_04_core_social_multi_account_e2e.sql'),
  'Database CI must execute the BR-04 multi-account pgTAP contract.',
);
expect(e2e.includes('select plan(34);'), 'BR-04 pgTAP plan must contain 34 assertions.');
expect(
  ['000000000001', '000000000002', '000000000003', '000000000004'].every((suffix) => e2e.includes(`4b000000-0000-0000-0000-${suffix}`)),
  'BR-04 must use four isolated deterministic actors.',
);

for (const operation of [
  'list_discovery_profiles',
  'send_friend_request',
  'respond_to_friend_request',
  'cancel_friend_request',
  'get_direct_conversation',
  'list_my_social_connections',
  'send_message',
  'list_conversation_messages',
  'list_my_conversations',
  'mark_conversation_read',
  'create_report',
  'block_user',
  'unblock_user',
  'get_profile_viewer',
]) {
  expect(e2e.includes(operation), `BR-04 pgTAP contract must exercise ${operation}.`);
}

expect(e2e.includes('throws_ok('), 'BR-04 must assert negative authorization paths.');
expect(e2e.includes('conversation_not_available'), 'BR-04 must deny non-member message reads.');
expect(e2e.includes('sender_not_conversation_member'), 'BR-04 must deny non-member message sends.');
expect(e2e.includes('report_rate_limited'), 'BR-04 must verify duplicate report throttling.');
expect(e2e.includes('messaging_blocked'), 'BR-04 must verify block immediately closes direct messaging.');
expect(e2e.trimEnd().endsWith('rollback;'), 'BR-04 fixtures and mutations must always roll back.');
expect(!e2e.includes('service_role'), 'BR-04 must not use a service-role credential.');
expect(!e2e.includes('MYFAN_E2E_BETA_PASSWORD'), 'BR-04 must not depend on the controlled Beta password.');

for (const financialOperation of [
  'send_gift',
  'request_withdrawal',
  'record_verified_play_purchase',
  'create_vietqr_heart_order',
]) {
  expect(!e2e.includes(financialOperation), `BR-04 must not exercise financial operation ${financialOperation}.`);
}

expect(releaseManifest.financialFeaturesEnabled === false, 'Financial feature flags must remain disabled.');
expect(releaseManifest.mergeAllowed === false, 'BR-04 must not authorize merge automatically.');
expect(releaseManifest.productionDeployAllowed === false, 'BR-04 must not authorize production deployment.');

for (const path of [
  'docs/br-04/README.md',
  'docs/br-04/TEST-MATRIX.md',
  'docs/br-04/ACCEPTANCE.md',
  'docs/br-04/STATUS.md',
]) {
  try {
    readText(path);
  } catch {
    errors.push(`Missing required BR-04 document: ${path}`);
  }
}

if (errors.length > 0) {
  console.error('BR-04 social E2E validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.warn('BR-04 social multi-account E2E source validation passed.');
console.warn('Coverage: discovery, friendship lifecycle, direct chat, read state, reporting, blocking, and rollback isolation.');
