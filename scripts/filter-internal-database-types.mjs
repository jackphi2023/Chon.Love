import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/filter-internal-database-types.mjs <database.types.ts>');
  process.exit(2);
}

const internalServiceRoleFunctions = [
  'admin_get_luxy_user_detail',
  'admin_list_luxy_users',
  'admin_set_luxy_user_discovery',
  'admin_set_luxy_user_status',
];

let source = readFileSync(file, 'utf8');

for (const name of internalServiceRoleFunctions) {
  const marker = `      ${name}: {\n`;
  const start = source.indexOf(marker);
  if (start < 0) {
    console.error(`Expected service-role-only RPC missing from generated types: ${name}`);
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

writeFileSync(file, source, 'utf8');
console.warn(`Filtered ${internalServiceRoleFunctions.length} service-role-only Admin RPCs from the client database contract.`);
