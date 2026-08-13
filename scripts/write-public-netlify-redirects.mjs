import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const context = process.env.CONTEXT ?? 'local';
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

if (!rawAppUrl) {
  if (context === 'production') {
    console.error('NEXT_PUBLIC_APP_URL is required for the production public-web deploy.');
    process.exit(1);
  }
  console.warn('NEXT_PUBLIC_APP_URL is not set; skipping public auth redirects outside production.');
  process.exit(0);
}

let appUrl;
try {
  const parsed = new URL(rawAppUrl);
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !local) throw new Error('Authenticated web URL must use HTTPS.');
  appUrl = parsed.origin;
} catch (error) {
  console.error(`Invalid NEXT_PUBLIC_APP_URL: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exit(1);
}

const outputDir = resolve('apps/public-web/out');
mkdirSync(outputDir, { recursive: true });
const redirects = [
  `/ intent=login ${appUrl}/auth?mode=login 302!`,
  `/ intent=signup ${appUrl}/auth 302!`,
  '',
].join('\n');
writeFileSync(resolve(outputDir, '_redirects'), redirects, 'utf8');
console.warn(`Public auth redirects written for ${appUrl}.`);
