import { readFileSync } from 'node:fs';

const readText = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readJson = (path) => JSON.parse(readText(path));

const manifest = readJson('config/releases/beta-mobile-web.json');
const packageJson = readJson('package.json');
const ciWorkflow = readText('.github/workflows/ci.yml');

const errors = [];
const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

expect(manifest.schemaVersion === 1, 'BR-02 manifest schemaVersion must be 1.');
expect(manifest.releaseId === 'beta-mobile-web', 'BR-02 releaseId must be beta-mobile-web.');
expect(
  manifest.canonicalBranch === 'release/beta-mobile-web',
  'Canonical integration branch must be release/beta-mobile-web.',
);
expect(manifest.integrationBase === 'develop', 'Beta integration base must be develop.');
expect(manifest.productionBranch === 'main', 'Production branch must remain main.');
expect(
  manifest.sourceBranch === 'agent/br-01-security-reconciliation',
  'BR-02 must preserve the audited BR-01 source branch anchor.',
);
expect(
  /^[0-9a-f]{40}$/.test(manifest.sourceCommit),
  'BR-02 sourceCommit must be a full 40-character commit SHA.',
);
expect(
  manifest.supabaseProjectRef === 'asnydvqsduonyidjyyzq',
  'BR-02 must retain the reconciled Supabase project reference.',
);
expect(manifest.status === 'draft', 'BR-02 must remain draft until Beta acceptance is complete.');
expect(manifest.mergeAllowed === false, 'BR-02 must not authorize merge automatically.');
expect(
  manifest.productionDeployAllowed === false,
  'BR-02 must not authorize a production deployment.',
);
expect(
  manifest.financialFeaturesEnabled === false,
  'BR-02 must keep financial feature flags disabled.',
);

expect(
  packageJson.scripts?.['validate:security'] === 'node scripts/validate-br01.mjs',
  'BR-01 security validation must remain enabled.',
);
expect(
  packageJson.scripts?.['validate:integration'] === 'node scripts/validate-br02.mjs',
  'package.json must expose validate:integration.',
);
expect(
  packageJson.scripts?.validate?.includes('validate:security') &&
    packageJson.scripts?.validate?.includes('validate:integration'),
  'The aggregate validate command must include BR-01 and BR-02 validation.',
);
expect(
  ciWorkflow.includes("'release/**'"),
  'Application CI must run for release/** branches.',
);
expect(
  ciWorkflow.includes('pnpm validate:integration'),
  'Application CI must execute BR-02 integration validation.',
);

for (const path of [
  'docs/br-02/README.md',
  'docs/br-02/INTEGRATION-MANIFEST.md',
  'docs/br-02/BRANCH-POLICY.md',
  'docs/br-02/ACCEPTANCE.md',
  'docs/br-02/STATUS.md',
]) {
  try {
    readText(path);
  } catch {
    errors.push(`Missing required BR-02 document: ${path}`);
  }
}

if (errors.length > 0) {
  console.error('BR-02 integration validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('BR-02 integration validation passed.');
console.log(`Canonical branch: ${manifest.canonicalBranch}`);
console.log(`Integration base: ${manifest.integrationBase}`);
console.log(`Audited source: ${manifest.sourceCommit}`);
