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
  browserCi.includes("email like 'br06.%@example.test'") && browserCi.includes('fixture count mismatch'),
  'Browser CI must verify exactly four isolated fixture users.',
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
  !fixtureSetup.includes('MYFAN_E2E_BETA_PASSWORD'),
  'BR-06 fixture setup must not depend on the controlled Beta password.',
);
expect(
  !fixtureSetup.includes('password,\n  mediaId'),
  'BR-06 fixture manifest must remain credential-free.',
);

expect(playwrightConfig.includes("testDir: './tests/br-06'"), 'Playwright must be scoped to the BR-06 test directory.');
expect(playwrightConfig.includes('width: 390') === false, 'Viewport belongs in isolated browser contexts, not global config.');
expect(playwrightConfig.includes('workers: 1'), 'BR-06 must run deterministically with one Playwright worker.');
expect(playwrightConfig.includes("trace: 'retain-on-failure'"), 'BR-06 must retain traces on failure.');
expect(playwrightConfig.includes('expo start --web --port 8081'), 'BR-06 must start the Expo Web application under test.');

for (const actor of ['creator', 'viewer', 'fan', 'outsider']) {
  expect(browserE2e.includes(`br06.${actor}@example.test`), `BR-06 must include the ${actor} browser actor.`);
}

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
console.warn('Coverage: local-only Auth, discovery/profile navigation, friendship, chat, Creator privacy, Activity album, reporting, block/unblock, and evidence artifacts.');
