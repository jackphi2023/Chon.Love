import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const names = ['development', 'staging', 'production'];
const productionProjectRef = 'asnydvqsduonyidjyyzq';
const productionProjectUrl = `https://${productionProjectRef}.supabase.co`;
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
  if (config.supabaseRegion !== 'ap-southeast-1') {
    throw new Error(`${config.name} must remain in ap-southeast-1 unless architecture is reviewed.`);
  }

  if (config.name === 'production') {
    if (config.supabaseProjectRef !== productionProjectRef || config.supabaseUrl !== productionProjectUrl) {
      throw new Error('Production must point to the current Chon.Love Supabase project.');
    }
    if (config.production !== true || config.supabaseLifecycle !== 'active-production') {
      throw new Error('Production environment must be explicitly marked active-production.');
    }
  } else {
    if (config.supabaseProjectRef || config.supabaseUrl) {
      throw new Error(`${config.name} must stay unconfigured until an isolated Supabase project is assigned.`);
    }
    if (config.production !== false || config.supabaseLifecycle !== 'unconfigured-isolated') {
      throw new Error(`${config.name} must be explicitly marked unconfigured-isolated.`);
    }
  }

  const envFile = path.join(root, `.env.${config.name}.example`);
  const env = parseDotEnv(await readFile(envFile, 'utf8'));
  if (env.MYFAN_ENV !== config.name) throw new Error(`${envFile} has the wrong MYFAN_ENV.`);
  if (env.EXPO_PUBLIC_MYFAN_ENV !== config.name || env.NEXT_PUBLIC_MYFAN_ENV !== config.name) {
    throw new Error(`${envFile} has inconsistent public environment labels.`);
  }

  if (config.name === 'production') {
    if (env.EXPO_PUBLIC_SUPABASE_URL !== productionProjectUrl || env.NEXT_PUBLIC_SUPABASE_URL !== productionProjectUrl) {
      throw new Error(`${envFile} must point to the production Supabase project.`);
    }
  } else if (env.EXPO_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(`${envFile} must not default a non-production environment to any Supabase project.`);
  }

  for (const key of ['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (env[key]) throw new Error(`${envFile} must not contain a committed value for ${key}.`);
  }
}

const netlifyFiles = [
  path.join(root, 'netlify.toml'),
  path.join(root, 'apps', 'mobile', 'netlify.toml'),
  path.join(root, 'apps', 'admin', 'netlify.toml'),
];
for (const file of netlifyFiles) {
  const content = await readFile(file, 'utf8');
  const projectOccurrences = content.split(productionProjectUrl).length - 1;
  if (projectOccurrences !== 1) {
    throw new Error(`${file} must reference the production Supabase URL exactly once, in production context only.`);
  }
  if (/qxsqrtnelbqquqgbamjo|fciyrjtqnifapafqythy/u.test(content)) {
    throw new Error(`${file} must not reference inactive MyFan Supabase projects.`);
  }
  if (/(?:EXPO_PUBLIC|NEXT_PUBLIC)_SUPABASE_ANON_KEY\s*=\s*"[^"]+"|SUPABASE_SERVICE_ROLE_KEY\s*=\s*"[^"]+"/u.test(content)) {
    throw new Error(`${file} must not commit Supabase keys.`);
  }
}

const publicWebNetlify = await readFile(path.join(root, 'apps', 'public-web', 'netlify.toml'), 'utf8');
if (!publicWebNetlify.includes('not a Chon.Love production Netlify target') || !publicWebNetlify.includes('exit 1')) {
  throw new Error('apps/public-web Netlify target must remain fail-closed.');
}
if (publicWebNetlify.includes(productionProjectUrl)) {
  throw new Error('Retired public-web Netlify target must not carry production Supabase configuration.');
}

console.warn('Environment validation passed: production is explicit and development/staging are isolated fail-closed configs.');
