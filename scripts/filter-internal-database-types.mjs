import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/filter-internal-database-types.mjs <database.types.ts>');
  process.exit(2);
}

const serverOnlyFunctions = [
  'admin_get_luxy_user_detail',
  'admin_list_luxy_users',
  'admin_set_luxy_user_discovery',
  'admin_set_luxy_user_status',
  'admin_list_luxy_reports',
  'admin_review_luxy_report',
  'get_public_chon_profile',
  'resolve_chon_member_route',
  'admin_get_homepage_settings',
  'admin_update_homepage_settings',
  'get_public_homepage_settings',
  'is_super_admin',
];

// Signup V2 is still an integration branch. Keep newly introduced staged RPCs
// on a runtime-validated structural client boundary until the final SU-11
// generated-types checkpoint, instead of granting this workflow write access.
const stagedRuntimeValidatedFunctions = [
  'save_my_signup_location_v2',
];

// homepage_settings is an implementation table. Direct anon/authenticated table access is revoked;
// public SEO/member routing and Admin clients consume only narrow, manually validated RPC contracts instead.
const serverOnlyTables = ['homepage_settings'];

let source = readFileSync(file, 'utf8');

function removeGeneratedBlocks(names, kind) {
  for (const name of names) {
    // Supabase emits both multiline blocks and compact one-line blocks such as
    // `is_super_admin: { Args: never; Returns: boolean }`; match both forms.
    const marker = `      ${name}: {`;
    const start = source.indexOf(marker);
    if (start < 0) {
      console.error(`Expected ${kind} missing from generated types: ${name}`);
      process.exit(1);
    }

    let depth = 0;
    let opened = false;
    let end = -1;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (char === '{') {
        depth += 1;
        opened = true;
      } else if (char === '}') {
        depth -= 1;
        if (opened && depth === 0) {
          end = index + 1;
          if (source[end] === ',') end += 1;
          if (source[end] === '\n') end += 1;
          break;
        }
      }
    }

    if (end < 0) {
      console.error(`Unable to isolate generated type block for ${name}`);
      process.exit(1);
    }
    source = source.slice(0, start) + source.slice(end);
  }
}

removeGeneratedBlocks(serverOnlyFunctions, 'server-only RPC');
removeGeneratedBlocks(stagedRuntimeValidatedFunctions, 'staged runtime-validated RPC');
removeGeneratedBlocks(serverOnlyTables, 'implementation table');

const beforeProfileCodeFilter = source;
source = source
  .split('\n')
  .filter((line) => !/^\s+public_profile_code\??:\s+string$/u.test(line))
  .join('\n');

if (source === beforeProfileCodeFilter) {
  console.error('Expected server-only profiles.public_profile_code fields missing from generated types.');
  process.exit(1);
}

writeFileSync(file, source, 'utf8');
console.warn(
  `Filtered ${serverOnlyFunctions.length} server-only RPCs, ${stagedRuntimeValidatedFunctions.length} staged Signup V2 RPC, ${serverOnlyTables.length} implementation table, plus profiles.public_profile_code from the client database contract.`,
);