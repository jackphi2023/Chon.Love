import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/admin',
  trailingSlash: true,
  reactStrictMode: true,
  transpilePackages: ['@myfan/config', '@myfan/domain', '@myfan/supabase', '@myfan/ui'],
};

export default nextConfig;
