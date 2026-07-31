import { readFileSync } from 'node:fs';

const readText = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readJson = (path) => JSON.parse(readText(path));

const packageJson = readJson('package.json');
const releaseManifest = readJson('config/releases/beta-mobile-web.json');
const applicationCi = readText('.github/workflows/ci.yml');
const databaseCi = readText('.github/workflows/database.yml');
const browserCi = readText('.github/workflows/browser-e2e.yml');
const fixtureSetup = readText('scripts/br06/setup-local-fixtures.mjs');
const playwrightConfig = readText('playwright.br06.config.mjs');
const browserE2e = readText('tests/br-06/mobile-web-multi-account.spec.mjs');
const sharedSupabaseClient = readText('packages/supabase/src/index.ts');
const mobileSupabaseClient = readText('apps/mobile/src/lib/supabase.ts');
const environmentUnitTest = readText('packages/supabase/src/index.test.ts');
const authHome = readText('apps/mobile/app/(auth)/index.tsx');
const storageHelperMigration = readText('supabase/migrations/20260731172253_br_06_storage_policy_helper_execution.sql');
const storageHelperAclTest = readText('supabase/tests/br_06_storage_policy_helper_acl.sql');

const errors = [];
const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

expect(
  packageJson.scripts?.['validate:browser-e2e'] === 'node scripts/validate-br06.mjs',
  'package.json must expose validate:browser-e2e.',
);
expect(
  packageJson.scripts?.validate?.includes('validate:creator-e2e') &&
    packageJson.scripts?.validate?.includes('validate:browser-e2e'),
  'The aggregate validate command must preserve BR-05 and include BR-06 validation.',
);
expect(
  applicationCi.includes('pnpm validate:browser-e2e'),
  'Application CI must execute the BR-06 browser source guard.',
);
expect(
  databaseCi.includes('scripts/validate-br06.mjs') && databaseCi.includes('docs/br-06/**'),
  'Database CI path filters must include BR-06 validation and documentation.',
);
expect(
  databaseCi.includes('20260731172253_br_06_storage_policy_helper_execution.sql') &&
    databaseCi.includes('supabase/tests/br_06_storage_policy_helper_acl.sql'),
  'Database CI inventory must include the BR-06 Storage helper migration and ACL test.',
);
expect(
  databaseCi.includes('Run BR-06 Storage policy helper ACL contract'),
  'Database CI must execute the BR-06 Storage helper ACL contract.',
);

for (const token of [
  'supabase start',
  'supabase db reset --local',
  'supabase status -o env',
  'scripts/br06/setup-local-fixtures.mjs',
  'psql "$DB_URL"',
  '@playwright/test@1.55.0',
  'playwright install --with-deps chromium',
  'playwright.br06.config.mjs',
  'br-06-browser-evidence',
  'supabase stop --no-backup',
]) {
  expect(browserCi.includes(token), `Browser CI must include ${token}.`);
}

expect(
  browserCi.includes('EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY'),
  'Browser CI must expose only the local public key to Expo Web.',
);
expect(
  !browserCi.includes('EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY'),
  'Browser CI must never expose a service-role key through an Expo public variable.',
);
expect(
  !browserCi.includes('echo "BR06_SUPABASE_SERVICE_ROLE_KEY='),
  'Browser CI must never write the service-role key to GITHUB_ENV.',
);
expect(
  browserCi.includes("email like 'br06.%@example.test') <> 5") &&
    browserCi.includes('BR-06 local fixture account count mismatch'),
  'Browser CI must verify exactly five isolated local fixture accounts.',
);
expect(
  browserCi.includes('BR-06 browser actor count mismatch') &&
    ['creator', 'viewer', 'fan', 'outsider'].every((actor) => browserCi.includes(`br06.${actor}@example.test`)),
  'Browser CI must separately verify the four browser actors.',
);
expect(
  browserCi.includes('br06.moderator@example.test') && browserCi.includes('local moderator fixture missing'),
  'Browser CI must verify the non-browser local moderator fixture.',
);

expect(
  fixtureSetup.includes("['127.0.0.1', 'localhost'].includes(parsedUrl.hostname)"),
  'BR-06 fixture setup must fail closed for non-local Supabase hosts.',
);
expect(
  fixtureSetup.includes('/auth/v1/admin/users') && fixtureSetup.includes('/storage/v1/object/profile-media/'),
  'BR-06 fixture setup must provision local Auth and Storage fixtures server-side.',
);
expect(
  fixtureSetup.includes('BR-06 local browser E2E fixture') && fixtureSetup.includes('BR06 approved Activity image'),
  'BR-06 fixture setup must prepare profile and Creator Activity browser data.',
);
expect(
  fixtureSetup.includes('br06.moderator@example.test') &&
    fixtureSetup.includes('private.user_roles') &&
    fixtureSetup.includes('approved_by'),
  'BR-06 fixture setup must use a valid local moderator as the media approval actor.',
);
expect(
  !fixtureSetup.includes('MYFAN_E2E_BETA_PASSWORD'),
  'BR-06 fixture setup must not depend on the controlled Beta password.',
);
expect(
  !fixtureSetup.includes('password,\n  mediaId'),
  'BR-06 fixture manifest must remain credential-free.',
);

expect(
  sharedSupabaseClient.includes('allowInsecureLocalhost?: boolean'),
  'The shared public client must require an explicit option for local HTTP.',
);
expect(
  sharedSupabaseClient.includes("['localhost', '127.0.0.1'].includes(url.hostname)"),
  'The shared public client must restrict local HTTP to localhost and 127.0.0.1.',
);
expect(
  sharedSupabaseClient.includes("url.protocol === 'http:'") && sharedSupabaseClient.includes("environment.url.startsWith('https://')"),
  'The shared public client must preserve HTTPS as the default transport rule.',
);
expect(
  mobileSupabaseClient.includes("allowInsecureLocalhost: environment.appEnvironment === 'development'"),
  'The mobile client must enable local HTTP only for the development environment.',
);
for (const unitCase of [
  'accepts HTTPS by default',
  'rejects localhost HTTP unless explicitly allowed',
  'http://localhost:54321',
  'http://127.0.0.1:54321',
  'rejects remote HTTP even when local development HTTP is enabled',
  'http://192.168.1.20:54321',
  'rejects unsafe browser credential',
]) {
  expect(environmentUnitTest.includes(unitCase), `BR-06 environment unit tests must cover: ${unitCase}.`);
}

expect(
  authHome.includes('const destination = await signInWithEmailPassword(email, password);') &&
    authHome.includes('router.replace(destination);'),
  'The Auth screen must navigate from the resolved authenticated destination.',
);
expect(
  !authHome.includes("if (auth.userId) router.replace('/');"),
  'The Auth screen must not compete with the submit handler through a second post-login redirect.',
);
expect(
  !authHome.includes('useEffect'),
  'The BR-06 Auth screen must keep post-login navigation single-source and effect-free.',
);

expect(
  storageHelperMigration.includes(
    'grant execute on function private.can_view_media_internal(uuid, uuid) to anon, authenticated;',
  ),
  'BR-06 must restore only the Storage RLS helper execution capability required by client roles.',
);
expect(
  !storageHelperMigration.includes('grant usage on schema private') &&
    !storageHelperMigration.includes('grant select on') &&
    !storageHelperMigration.includes('grant all'),
  'BR-06 Storage migration must not reopen private schema or table access.',
);
expect(storageHelperAclTest.includes('select plan(5);'), 'BR-06 Storage ACL contract must contain five assertions.');
for (const aclAssertion of [
  "has_function_privilege('anon', 'private.can_view_media_internal(uuid,uuid)', 'EXECUTE')",
  "has_function_privilege('authenticated', 'private.can_view_media_internal(uuid,uuid)', 'EXECUTE')",
  "not has_schema_privilege('anon', 'private', 'USAGE')",
  "not has_schema_privilege('authenticated', 'private', 'USAGE')",
  "table_schema = 'private'",
]) {
  expect(storageHelperAclTest.includes(aclAssertion), `BR-06 Storage ACL contract must assert ${aclAssertion}.`);
}

expect(playwrightConfig.includes("testDir: './tests/br-06'"), 'Playwright must be scoped to the BR-06 test directory.');
expect(playwrightConfig.includes('width: 390') === false, 'Viewport belongs in isolated browser contexts, not global config.');
expect(playwrightConfig.includes('workers: 1'), 'BR-06 must run deterministically with one Playwright worker.');
expect(playwrightConfig.includes("trace: 'retain-on-failure'"), 'BR-06 must retain traces on failure.');
expect(playwrightConfig.includes('expo start --web --port 8081'), 'BR-06 must start the Expo Web application under test.');

for (const actor of ['creator', 'viewer', 'fan', 'outsider']) {
  expect(browserE2e.includes(`br06.${actor}@example.test`), `BR-06 must include the ${actor} browser actor.`);
}
expect(!browserE2e.includes('br06.moderator@example.test'), 'The local moderator must not receive a browser context.');

for (const flow of [
  'Đăng nhập bằng email',
  'Gửi lời mời kết bạn',
  'Chấp nhận',
  'Bạn bè',
  'Chỉ Fan',
  'Album Hoạt động',
  'Nội dung tin nhắn',
  'Báo cáo tin nhắn',
  'Chặn',
  'Bỏ chặn',
  'Không tìm thấy hồ sơ',
]) {
  expect(browserE2e.includes(flow), `BR-06 browser lifecycle must exercise ${flow}.`);
}

expect(browserE2e.includes('width: 390') && browserE2e.includes('height: 844'), 'BR-06 must use a mobile browser viewport.');
expect(browserE2e.includes("testInfo.attach('br06-final-unblocked-profile'"), 'BR-06 must attach final browser evidence.');

for (const forbidden of [
  'myfan1@gmail.com',
  'myfan16@gmail.com',
  'MYFAN_E2E_BETA_PASSWORD',
  'send_gift(',
  'request_withdrawal(',
  'record_verified_play_purchase(',
  'create_vietqr_heart_order(',
]) {
  expect(!browserE2e.includes(forbidden), `BR-06 browser E2E must not contain ${forbidden}.`);
}

expect(releaseManifest.financialFeaturesEnabled === false, 'Financial feature flags must remain disabled.');
expect(releaseManifest.mergeAllowed === false, 'BR-06 must not authorize merge automatically.');
expect(releaseManifest.productionDeployAllowed === false, 'BR-06 must not authorize production deployment.');

for (const path of [
  'docs/br-06/README.md',
  'docs/br-06/TEST-MATRIX.md',
  'docs/br-06/ACCEPTANCE.md',
  'docs/br-06/STATUS.md',
]) {
  try {
    readText(path);
  } catch {
    errors.push(`Missing required BR-06 document: ${path}`);
  }
}

if (errors.length > 0) {
  console.error('BR-06 browser E2E validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.warn('BR-06 mobile web multi-account browser E2E source validation passed.');
console.warn('Coverage: least-privilege Storage signed URLs, single-source auth routing, local-only transport opt-in, five local fixture accounts, four mobile browser actors, friendship, chat, Creator privacy, Activity album, reporting, block/unblock, and evidence artifacts.');
