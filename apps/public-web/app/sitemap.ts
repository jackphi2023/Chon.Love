import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '../src/lib/environment';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPublicSiteUrl();
  if (!siteUrl) return [];

  const lastModified = new Date('2026-07-31T00:00:00.000Z');
  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/qua-tang`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/terms`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    {
      url: `${siteUrl}/community-standards`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];
}
