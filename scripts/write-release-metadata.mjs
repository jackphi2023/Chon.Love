import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { releaseContractPath, sha256, validateReleaseContract } from './validate-release-contract.mjs';

const contract = validateReleaseContract();
const sourceCommit = process.env.COMMIT_REF || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) throw new Error('A full source commit is required for release metadata.');
// Next regenerates its environment declaration during every build. Exclude
// that framework-owned file while still rejecting changes to release source.
const sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=no', '--', '.', ':(exclude)apps/admin/next-env.d.ts'], { encoding: 'utf8' }).trim());
if (process.env.CONTEXT === 'production' && sourceDirty) throw new Error('Production build must use a clean committed source tree.');
writeFileSync('apps/mobile/dist/release.json', JSON.stringify({
  schemaVersion: 1,
  releaseId: contract.releaseId,
  sourceCommit,
  sourceDirty,
  context: process.env.CONTEXT || 'local',
  builtAt: new Date().toISOString(),
  contractSha256: sha256(readFileSync(releaseContractPath)),
  migrationVersion: contract.migrations.latestVersion,
  financialFeaturesEnabled: contract.financialFeaturesEnabled,
}, null, 2) + '\n');
console.warn(`Release metadata written for ${sourceCommit}.`);
