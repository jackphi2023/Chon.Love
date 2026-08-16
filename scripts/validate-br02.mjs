import { readFileSync } from 'node:fs';

const readText = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readJson = (path) => JSON.parse(readText(path));

const manifest = readJson('config/releases/chon-web-v1.json');
const packageJson = readJson('package.json');
const ciWorkflow = readText('.github/workflows/ci.yml');

const errors = [];
const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

expect(manifest.schemaVersion === 1, 'Chon.Love release manifest schemaVersion must be 1.');
expect(manifest.releaseId === 'chon-web-v1', 'Active releaseId must be chon-web-v1.');
expect(manifest.canonicalBranch === 'main', 'Canonical Chon.Love branch must be main.');
expect(manifest.integrationBase === 'main', 'Active integration base must be main.');
expect(manifest.productionBranch === 'main', 'Production branch must be main.');
expect(manifest.sourceBranch === 'main', 'Active release source branch must be main.');
expect(/^[0-9a-f]{40}$/.test(manifest.baselineCommit), 'baselineCommit must be a full 40-character commit SHA.');
expect(
  typeof manifest.baselineNote === 'string' && manifest.baselineNote.includes('may advance after this anchor'),
  'The manifest must distinguish the audited baseline anchor from the moving main head.',
);
expect(
  typeof manifest.historyNote === 'string' && manifest.historyNote.includes('active release validators use this Chon.Love Web V1 manifest'),
  'The manifest must distinguish historical MyFan/Luxy/Beta identifiers from the active Chon.Love release source.',
);
expect(
  manifest.supabaseProjectRef === 'asnydvqsduonyidjyyzq',
  'Active release manifest must retain the reconciled Chon.Love Supabase project reference.',
);
expect(manifest.deploymentTarget === 'netlify-production', 'Deployment target must be netlify-production.');
expect(manifest.status === 'prelive', 'Chon.Love Web V1 must remain prelive until explicit live acceptance.');
expect(manifest.mergeAllowed === false, 'The manifest must not authorize automatic merges.');
expect(
  manifest.productionDeployAllowed === false,
  'The manifest must not authorize an automatic production deploy before explicit live acceptance.',
);
expect(
  manifest.financialFeaturesEnabled === false,
  'Financial feature flags must remain disabled for the current Web V1 baseline.',
);

expect(
  packageJson.scripts?.['validate:security'] === 'node scripts/validate-br01.mjs',
  'Security validation must remain enabled.',
);
expect(
  packageJson.scripts?.['validate:integration'] === 'node scripts/validate-br02.mjs',
  'package.json must expose validate:integration.',
);
expect(
  packageJson.scripts?.validate?.includes('validate:security') &&
    packageJson.scripts?.validate?.includes('validate:integration'),
  'The aggregate validate command must include security and active release-source validation.',
);
expect(ciWorkflow.includes('branches: [main,'), 'Application CI must run on main.');
expect(
  ciWorkflow.includes('pnpm validate:integration'),
  'Application CI must execute active Chon.Love release-source validation.',
);

if (errors.length > 0) {
  console.error('Chon.Love release-source validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.warn('Chon.Love release-source validation passed.');
console.warn(`Canonical branch: ${manifest.canonicalBranch}`);
console.warn(`Deployment target: ${manifest.deploymentTarget}`);
console.warn(`Audited baseline commit: ${manifest.baselineCommit}`);
