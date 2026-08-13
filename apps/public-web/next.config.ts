import type { NextConfig } from 'next';

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/u, '');
const validAppUrl = Boolean(appUrl && (appUrl.startsWith('/') || /^https:\/\//u.test(appUrl)));
if (process.env.CONTEXT === 'production') {
  if (!validAppUrl) throw new Error('NEXT_PUBLIC_APP_URL is required and must be an HTTPS URL or a root-relative path for the production public-web deploy.');
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required for production public member profiles.');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@myfan/config', '@myfan/domain', '@myfan/supabase', '@myfan/ui'],
  images: { remotePatterns: [{ protocol: 'https', hostname: 'asnydvqsduonyidjyyzq.supabase.co', pathname: '/functions/v1/public-profile-avatar' }] },
  async redirects() {
    if (!appUrl) return [];
    return [
      { source: '/', has: [{ type: 'query', key: 'intent', value: 'login' }], destination: `${appUrl}/auth?mode=login`, permanent: false },
      { source: '/', has: [{ type: 'query', key: 'intent', value: 'signup' }], destination: `${appUrl}/auth`, permanent: false },
    ];
  },
};
export default nextConfig;
