import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '../src/lib/environment';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl();
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/hoat-dong', '/qua-tang'] }],
    ...(siteUrl ? { sitemap: `${siteUrl}/sitemap.xml`, host: siteUrl } : {}),
  };
}
