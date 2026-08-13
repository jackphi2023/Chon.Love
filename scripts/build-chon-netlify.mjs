import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const context = process.env.CONTEXT ?? '';
const production = context === 'production';
const rawSiteUrl = process.env.URL?.trim().replace(/\/$/u, '') ?? '';
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

if (production) {
  if (!/^https:\/\//u.test(rawSiteUrl)) throw new Error('Netlify URL must be an HTTPS origin for the Chon.Love production build.');
  if (!supabaseUrl) throw new Error('Supabase URL is required for the authenticated Chon.Love web app.');
  if (!anonKey) throw new Error('Supabase anon key is required for the authenticated Chon.Love web app.');
}

function run(args, env) {
  const result = spawnSync('pnpm', args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const appBasePath = '/app';
const appOrigin = rawSiteUrl ? `${rawSiteUrl}${appBasePath}` : (process.env.NEXT_PUBLIC_APP_URL?.trim() || appBasePath);
const sharedEnvironment = {
  ...process.env,
  EXPO_PUBLIC_MYFAN_ENV: production ? 'production' : (process.env.EXPO_PUBLIC_MYFAN_ENV || 'development'),
  EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
};

run(['--filter', '@myfan/mobile', 'build:web'], {
  ...sharedEnvironment,
  EXPO_PUBLIC_WEB_BASE_URL: appBasePath,
});

const mobileDist = resolve(root, 'apps/mobile/dist');
const mobileIndex = resolve(mobileDist, 'index.html');
const embeddedApp = resolve(root, 'apps/public-web/public/app');
if (!existsSync(mobileIndex)) throw new Error('Authenticated app build did not produce apps/mobile/dist/index.html.');
const mobileHtml = readFileSync(mobileIndex, 'utf8');
if (!mobileHtml.includes(`${appBasePath}/`)) throw new Error('Authenticated Expo build is missing the /app base path required by the combined Chon.Love deployment.');
rmSync(embeddedApp, { recursive: true, force: true });
mkdirSync(embeddedApp, { recursive: true });
cpSync(mobileDist, embeddedApp, { recursive: true });
if (!existsSync(resolve(embeddedApp, 'index.html'))) throw new Error('Embedded authenticated app index.html was not copied into the public site.');

run(['--filter', '@myfan/public-web', 'build'], {
  ...sharedEnvironment,
  NEXT_PUBLIC_SITE_URL: rawSiteUrl || process.env.NEXT_PUBLIC_SITE_URL || '',
  NEXT_PUBLIC_APP_URL: appOrigin,
});
