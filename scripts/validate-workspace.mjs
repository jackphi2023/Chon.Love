import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const required = [
  'apps/mobile/package.json',
  'apps/admin/package.json',
  'apps/public-web/package.json',
  'packages/domain/package.json',
  'packages/validation/package.json',
  'packages/supabase/package.json',
  'packages/ui/package.json',
  'packages/config/package.json',
  '.github/workflows/ci.yml',
  '.env.example',
  'README.md',
];

for (const file of required) {
  await access(path.join(root, file));
}

const packageFiles = [
  'package.json',
  'apps/mobile/package.json',
  'apps/admin/package.json',
  'apps/public-web/package.json',
  'packages/domain/package.json',
  'packages/validation/package.json',
  'packages/supabase/package.json',
  'packages/ui/package.json',
  'packages/config/package.json',
];

for (const file of packageFiles) {
  JSON.parse(await readFile(path.join(root, file), 'utf8'));
}

const forbiddenNames = ['.env', '.env.local', 'service-account.json', 'google-services.json'];
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relative = path.relative(root, fullPath);
    if (forbiddenNames.includes(entry.name)) {
      throw new Error(`Forbidden secret file detected: ${relative}`);
    }
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      await walk(fullPath);
    }
  }
}
await walk(root);

const envExample = await readFile(path.join(root, '.env.example'), 'utf8');
if (/SUPABASE_SERVICE_ROLE_KEY=\S+/.test(envExample)) {
  throw new Error('Service-role key must be blank in .env.example');
}

process.stdout.write('Workspace structure, JSON files and secret guards: PASS\n');
