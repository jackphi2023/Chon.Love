import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '../src/lib/environment';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    ...(siteUrl ? { sitemap: `${siteUrl}/sitemap.xml`, host: siteUrl } : {}),
  };
}
