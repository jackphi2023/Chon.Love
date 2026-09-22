import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const releaseContractPath = 'config/releases/chon-opt-ae.json';
export const requiredEdgeFunctions = [
  'homepage-media-admin', 'media-access', 'media-moderation',
  'member-photo-verification', 'member-profile-verification-admin',
  'public-profile-avatar', 'public-profile-media', 'public-profile-seo', 'user-admin',
];
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
// Ignore only line endings and a final newline, never source tokens or SQL text.
export const sourceHash = (value) => sha256(value.replaceAll('\r\n', '\n').trimEnd() + '\n');

export function migrationInventory(root = '.') {
  const directory = resolve(root, 'supabase/migrations');
  const files = readdirSync(directory).filter((name) => /^\d{14}_.+\.sql$/u.test(name)).sort();
  return {
    count: files.length,
    latestVersion: files.at(-1)?.slice(0, 14),
    sha256: sha256(files.map((name) => `${name}:${sourceHash(readFileSync(resolve(directory, name), 'utf8'))}`).join('\n')),
  };
}

export function validateReleaseContract(root = '.') {
  const read = (path) => readFileSync(resolve(root, path), 'utf8');
  const contract = JSON.parse(read(releaseContractPath));
  const errors = [];
  if (contract.schemaVersion !== 1 || contract.productionOrigin !== 'https://chon.love'
    || contract.projectRef !== 'asnydvqsduonyidjyyzq' || contract.financialFeaturesEnabled !== false) {
    errors.push('Release identity, primary domain or disabled financial contract changed.');
  }
  const actual = migrationInventory(root);
  if (JSON.stringify(actual) !== JSON.stringify(contract.migrations)) errors.push('Migration inventory differs from the reviewed release contract.');
  if (sourceHash(read('packages/supabase/src/database.types.ts')) !== contract.databaseTypesSha256) {
    errors.push('Public database types differ from the reviewed release contract.');
  }
  const entries = contract.edgeFunctions ?? [];
  if (JSON.stringify(entries.map((entry) => entry.name).sort()) !== JSON.stringify(requiredEdgeFunctions)) {
    errors.push('Required A–E Edge Function inventory is incomplete or duplicated.');
  }
  const config = read('supabase/config.toml');
  for (const entry of entries) {
    if (!requiredEdgeFunctions.includes(entry.name)) continue;
    if (!Number.isInteger(entry.hostedVersion) || entry.hostedVersion < 1) errors.push(`${entry.name}: missing reviewed hosted version.`);
    if (sourceHash(read(`supabase/functions/${entry.name}/index.ts`)) !== entry.sourceSha256) {
      errors.push(`${entry.name}: source changed since hosted parity was recorded; verify/deploy and update the contract.`);
    }
    const section = config.split(`[functions.${entry.name}]`)[1]?.split('\n[')[0];
    if (!section?.includes(`verify_jwt = ${entry.verifyJwt}`)) errors.push(`${entry.name}: JWT configuration differs from the release contract.`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return contract;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateReleaseContract();
  console.warn('A–E release contract passed: migration inventory, public types and required Edge source/JWT settings match the reviewed snapshot.');
}
