import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const readText = (path) => readFileSync(join(root, path), 'utf8');
const readJson = (path) => JSON.parse(readText(path));

const packageJson = readJson('package.json');
const releaseManifest = readJson('config/releases/chon-web-v1.json');
const ci = readText('.github/workflows/ci.yml');
const database = readText('.github/workflows/database.yml');
const browser = readText('.github/workflows/browser-e2e.yml');
const lx15 = readText('.github/workflows/lx15-contract.yml');

const errors = [];
const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

const opt15Hook = 'scripts/validate-opt15-global-qa.mjs';
const count = (source, token) => source.split(token).length - 1;

expect(
  packageJson.scripts?.['validate:opt15'] === 'node scripts/validate-opt15-global-qa.mjs',
  'package.json must expose validate:opt15.',
);
expect(
  packageJson.scripts?.validate?.includes('validate:opt15'),
  'The aggregate validate command must include the OPT-15 source guard.',
);
expect(
  ci.includes('pnpm validate:opt15'),
  'Application CI must execute the OPT-15 source guard.',
);

for (const [name, workflow] of [
  ['Database', database],
  ['Browser E2E', browser],
  ['LX-15 Contract', lx15],
]) {
  expect(
    count(workflow, opt15Hook) >= 2,
    `${name} must include the OPT-15 hook in both push and pull-request path filters.`,
  );
  expect(
    workflow.includes("'release/**'"),
    `${name} must continue to run on release/** branches.`,
  );
}

for (const token of [
  'pnpm validate:workspace',
  'pnpm validate:environments',
  'pnpm validate:security',
  'pnpm validate:integration',
  'pnpm validate:auth',
  'pnpm validate:social-e2e',
  'pnpm validate:browser-e2e',
  'pnpm validate:kyc-withdrawal-operations',
  'pnpm validate:runtime-quality',
  'pnpm validate:netlify-release',
  'pnpm validate:branding',
  'pnpm validate:seo-public-profile',
  'pnpm lint',
  'pnpm typecheck',
  'pnpm test',
  'pnpm build',
]) {
  expect(ci.includes(token), `Application CI must retain ${token}.`);
}

for (const token of [
  'supabase db reset --local',
  'supabase/tests/opt_01_approval_contract.sql',
  'supabase/tests/opt_02_media_moderation_integrity.sql',
  'supabase/tests/opt_03_admin_review.sql',
  'supabase/tests/opt_04_member_visibility.sql',
  'supabase/tests/opt_05_profile_edit.sql',
  'supabase/tests/br_08_kyc_withdrawal_operational_flow.sql',
  'supabase/tests/09_concurrency.sh',
  'supabase/tests/10_withdrawal_concurrency.sh',
  'supabase db lint --local --schema public --schema private --level warning',
  'cmp --silent /tmp/database.types.ts packages/supabase/src/database.types.ts',
  'pnpm validate',
  'pnpm lint',
  'pnpm typecheck',
  'pnpm test',
]) {
  expect(database.includes(token), `Database gate must retain ${token}.`);
}

for (const token of [
  'supabase db reset --local',
  'scripts/br06/setup-local-fixtures.mjs',
  'scripts/br06/approve-opt01-listing-fixtures.sql',
  'scripts/br06/seed-local-heart-balance.sql',
  'playwright.br06.config.mjs',
  'playwright.br09.config.mjs',
  'br-06-browser-evidence',
  'br-09-browser-evidence',
]) {
  expect(browser.includes(token), `Browser E2E gate must retain ${token}.`);
}
expect(
  !browser.includes('EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY'),
  'Browser E2E must never expose a service-role key to Expo public runtime.',
);
expect(
  browser.includes("email like 'br06.%@example.test'") && browser.includes('controlled Beta accounts must not exist'),
  'Browser E2E must retain local fixture isolation checks.',
);

for (const token of [
  'supabase db reset --local',
  'supabase/tests/lx_14_private_photo_premium_entitlements.sql',
  'supabase/tests/lx_15_direct_messaging_entitlement.sql',
  'supabase db lint --local --schema public --schema private --level warning',
]) {
  expect(lx15.includes(token), `LX-15 Contract must retain ${token}.`);
}

const requiredBrowserSpecs = [
  'tests/br-06/luxy-public-homepage.spec.mjs',
  'tests/br-06/chon-homepage-opt07.spec.mjs',
  'tests/br-06/chon-auth-password-auth01.spec.mjs',
  'tests/br-06/chon-connect-c01.spec.mjs',
  'tests/br-06/luxy-member-profile.spec.mjs',
  'tests/br-06/chon-gift-transaction-opt09.spec.mjs',
  'tests/br-06/chon-chat-realtime-opt10.spec.mjs',
  'tests/br-06/chon-balance-bal01.spec.mjs',
  'tests/br-06/chon-withdrawal-opt12.spec.mjs',
];
for (const path of requiredBrowserSpecs) {
  expect(existsSync(join(root, path)), `Missing required OPT-15 browser coverage: ${path}.`);
}

for (const path of [
  'apps/admin/app/kyc-withdrawal-operations/kyc-withdrawal-operations-client.tsx',
  'apps/admin/app/(protected)/users/user-admin.tsx',
  'supabase/tests/br_08_kyc_withdrawal_operational_flow.sql',
  'supabase/tests/10_withdrawal_concurrency.sh',
]) {
  expect(existsSync(join(root, path)), `Missing required Admin/financial regression surface: ${path}.`);
}

const collectSpecs = (directory) => {
  const absoluteDirectory = join(root, directory);
  if (!existsSync(absoluteDirectory)) return [];
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current)) {
      const absolute = join(current, entry);
      if (statSync(absolute).isDirectory()) visit(absolute);
      else if (/\.spec\.mjs$/.test(entry)) files.push(absolute);
    }
  };
  visit(absoluteDirectory);
  return files;
};

for (const absolutePath of [...collectSpecs('tests/br-06'), ...collectSpecs('tests/br-09')]) {
  const source = readFileSync(absolutePath, 'utf8');
  const repoPath = relative(root, absolutePath).replaceAll('\\', '/');
  for (const pattern of [
    /\btest\.(?:skip|fixme|only)\s*\(/,
    /\bdescribe\.(?:skip|only)\s*\(/,
  ]) {
    expect(!pattern.test(source), `OPT-15 forbids disabled/focused browser coverage in ${repoPath}.`);
  }
}

expect(releaseManifest.mergeAllowed === false, 'OPT-15 must not authorize merge before OPT-16.');
expect(releaseManifest.productionDeployAllowed === false, 'OPT-15 must not authorize production deploy before OPT-16.');
expect(releaseManifest.canonicalBranch === 'main', 'The canonical production branch must remain main.');
expect(releaseManifest.productionBranch === 'main', 'The production branch must remain main.');

if (errors.length > 0) {
  console.error('OPT-15 global QA source validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.warn('OPT-15 global QA source validation passed.');
console.warn('Required gates: Application CI, Database, Browser E2E (BR-06 + BR-09), and LX-15 Contract. Merge/deploy remain blocked until OPT-16.');
