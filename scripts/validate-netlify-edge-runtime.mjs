import { readFileSync } from 'node:fs';

const source = readFileSync('netlify/edge-functions/seo.ts', 'utf8');
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(source.includes("onError: 'bypass'"), 'SEO Edge Function must fail open with onError=bypass.');
expect(!source.includes("replaceAll(':', '\\\\:')"), 'SEO Edge Function must not escape colon as \\: under Unicode RegExp mode.');
expect(source.includes('/seo/chonlove-homepage-thumbnail.jpg'), 'SEO Edge Function must use the dedicated optimized homepage social thumbnail for static pages.');
expect(!source.includes('/seo/chonlove-thumbnail.jpg'), 'SEO Edge Function must not fall back to the retired global social thumbnail.');
expect(source.includes('imageUrl: STATIC_SOCIAL_IMAGE'), 'Static-page Edge metadata must route through the dedicated social-image constant.');
expect(source.includes('imageWidth: 480') && source.includes('imageHeight: 360'), 'Static-page Edge metadata must publish the optimized thumbnail dimensions.');
expect(source.includes('imageUrl: profile.avatar_url'), 'Public member Edge metadata must continue using the member-specific approved avatar.');

const metaKeysMatch = source.match(/const metaKeys = \[([\s\S]*?)\]\.join\('\|'\);/u);
expect(Boolean(metaKeysMatch), 'Unable to locate SEO metaKeys declaration.');

if (metaKeysMatch) {
  const metaKeys = [...metaKeysMatch[1].matchAll(/'([^']+)'/gu)].map((match) => match[1]).join('|');
  try {
    const metaPattern = new RegExp(`<meta\\b[^>]*(?:name|property)=["'](?:${metaKeys})["'][^>]*>`, 'giu');
    const sample = '<head><meta property="og:title" content="old"><meta name="description" content="old"></head>';
    const cleaned = sample.replace(metaPattern, '');
    expect(!cleaned.includes('og:title') && !cleaned.includes('description'), 'SEO metadata RegExp must match existing OG/description tags.');
  } catch (error) {
    failures.push(`SEO metadata RegExp must compile in a Unicode JavaScript runtime: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length) {
  console.error('Netlify SEO Edge runtime validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.warn('Netlify SEO Edge runtime validation passed: metadata RegExp compiles, middleware fails open, static pages use the optimized homepage thumbnail, and public profiles retain member-specific avatars.');
