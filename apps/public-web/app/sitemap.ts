import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '../src/lib/environment';
export const dynamic = 'force-static';
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPublicSiteUrl(); if (!siteUrl) return [];
  const lastModified = new Date('2026-08-13T00:00:00.000Z');
  const routes: Array<[string, MetadataRoute.Sitemap[number]['changeFrequency'], number]> = [['/','weekly',1],['/about','monthly',0.7],['/how-it-works','monthly',0.8],['/safety','monthly',0.8],['/premium','weekly',0.8],['/diamond','weekly',0.8],['/privacy','monthly',0.5],['/terms','monthly',0.5],['/community-standards','monthly',0.6]];
  return routes.map(([path, changeFrequency, priority]) => ({ url: `${siteUrl}${path}`, lastModified, changeFrequency, priority }));
}
