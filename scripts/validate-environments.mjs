import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const names = ['development', 'staging', 'production'];
const selectedPhaseCProjectRef = 'asnydvqsduonyidjyyzq';
const selectedPhaseCProjectUrl = `https://${selectedPhaseCProjectRef}.supabase.co`;
const expectedBranches = {
  development: 'develop',
  staging: 'release/staging',
  production: 'main',
};

function parseDotEnv(content) {
  return Object.fromEntries(
    content
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        if (index < 1) throw new Error(`Invalid dotenv line: ${line}`);
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

const configs = await Promise.all(
  names.map(async (name) => {
    const file = path.join(root, 'config', 'environments', `${name}.json`);
    return JSON.parse(await readFile(file, 'utf8'));
  }),
);

for (const config of configs) {
  if (!names.includes(config.name)) throw new Error(`Unknown environment: ${config.name}`);
  if (config.gitBranch !== expectedBranches[config.name]) {
    throw new Error(`${config.name} must use branch ${expectedBranches[config.name]}`);
  }
  if (config.supabaseProjectRef !== selectedPhaseCProjectRef) {
    throw new Error(`${config.name} must use the selected Phase C Supabase development project.`);
  }
  if (config.supabaseUrl !== selectedPhaseCProjectUrl) {
    throw new Error(`Supabase URL/ref mismatch for ${config.name}.`);
  }
  if (config.supabaseRegion !== 'ap-southeast-1') {
    throw new Error(`${config.name} must remain in ap-southeast-1 unless architecture is reviewed.`);
  }

  const envFile = path.join(root, `.env.${config.name}.example`);
  const env = parseDotEnv(await readFile(envFile, 'utf8'));
  if (env.MYFAN_ENV !== config.name) throw new Error(`${envFile} has the wrong MYFAN_ENV.`);
  if (env.EXPO_PUBLIC_MYFAN_ENV !== config.name || env.NEXT_PUBLIC_MYFAN_ENV !== config.name) {
    throw new Error(`${envFile} has inconsistent public environment labels.`);
  }
  if (env.EXPO_PUBLIC_SUPABASE_URL !== config.supabaseUrl || env.NEXT_PUBLIC_SUPABASE_URL !== config.supabaseUrl) {
    throw new Error(`${envFile} points at the wrong Supabase project.`);
  }
  for (const key of ['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (env[key]) throw new Error(`${envFile} must not contain a committed value for ${key}.`);
  }
}

const netlifyFiles = [
  path.join(root, 'apps', 'mobile', 'netlify.toml'),
  path.join(root, 'apps', 'admin', 'netlify.toml'),
  path.join(root, 'apps', 'public-web', 'netlify.toml'),
];
for (const file of netlifyFiles) {
  const content = await readFile(file, 'utf8');
  if (!content.includes(selectedPhaseCProjectUrl)) {
    throw new Error(`${file} is missing the selected Phase C Supabase development URL.`);
  }
  if (/qxsqrtnelbqquqgbamjo|fciyrjtqnifapafqythy/u.test(content)) {
    throw new Error(`${file} must not reference inactive MyFan Supabase projects.`);
  }
  if (/SUPABASE_(?:ANON|SERVICE_ROLE)_KEY\s*=\s*"[^"]+"/u.test(content)) {
    throw new Error(`${file} must not commit Supabase keys.`);
  }
}

console.warn('All Phase C app and web surfaces use the selected Supabase development project without committed keys.');
