import { existsSync, readFileSync, statSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

const description = 'Chon.Love là nền tảng hẹn hò dành cho người dùng thật và văn minh, hướng tới các mối quan hệ lành mạnh, chất lượng và xứng tầm';
const titleSuffix = 'Chọn.love - Chọn đúng Người, Yêu đúng Gu';
const rootLayout = read('apps/mobile/app/_layout.tsx');
const rootHtml = read('apps/mobile/app/+html.tsx');
const publicRoute = read('apps/mobile/app/thanh-vien/[id].tsx');
const sharedPublicProfile = read('packages/supabase/src/public-profile.ts');
const sharedIndex = read('packages/supabase/src/index.ts');
const netlifySeo = read('netlify/edge-functions/seo.ts');
const supabaseSeo = read('supabase/functions/public-profile-seo/index.ts');
const supabaseConfig = read('supabase/config.toml');
const browserTest = read('tests/br-09/observability-accessibility-resilience.spec.mjs');
const packageJson = JSON.parse(read('package.json'));
const ci = read('.github/workflows/ci.yml');

expect(existsSync('apps/mobile/public/seo/chonlove-thumbnail.jpg'), 'Global Chọn.love social thumbnail must be committed.');
if (existsSync('apps/mobile/public/seo/chonlove-thumbnail.jpg')) {
  const size = statSync('apps/mobile/public/seo/chonlove-thumbnail.jpg').size;
  expect(size > 50_000 && size < 1_000_000, 'Global social thumbnail should be an optimized production image between 50KB and 1MB.');
}

expect(rootHtml.includes(description), 'Default HTML metadata must use the approved SEO description.');
expect(rootHtml.includes('seo/chonlove-thumbnail.jpg'), 'Default HTML metadata must use the supplied Chọn.love social thumbnail.');
expect(rootHtml.includes('og:title') && rootHtml.includes('og:description') && rootHtml.includes('og:image'), 'Default HTML must expose Open Graph metadata.');
expect(rootHtml.includes('twitter:card') && rootHtml.includes('twitter:image'), 'Default HTML must expose Twitter/X card metadata.');
expect(rootHtml.includes(`Trang chủ | ${titleSuffix}`), 'Homepage must use the requested title convention.');

expect(sharedPublicProfile.includes('/^id-([0-9a-f]{6})$/u'), 'Public member route IDs must use id-xxxxxx public codes, never usernames or auth UUIDs.');
expect(sharedPublicProfile.includes("rpc('get_public_chon_profile'"), 'Public member data must come from the existing safe public profile RPC.');
expect(sharedIndex.includes("export * from './public-profile';"), 'Shared Supabase entry point must export the public profile client.');

expect(publicRoute.includes("useLocalSearchParams<{ id?"), 'Public profile screen must be keyed by member public ID.');
expect(publicRoute.includes('publicProfileCodeFromRouteId'), 'Public profile screen must validate id-xxxxxx routes.');
expect(publicRoute.includes('publicProfileAvatarUrl'), 'Public profile screen must use the matching member avatar, not the global thumbnail.');
expect(publicRoute.includes('`Thành viên ${profile.display_name} | ${TITLE_SUFFIX}`'), 'Public profile browser title must include the member display name.');
expect(!publicRoute.includes("pathname: '/profile/[username]'"), 'Public profile screen must not expose username-based canonical URLs.');

expect(rootLayout.includes("pathname.startsWith('/thanh-vien/')"), 'Guest routing must explicitly allow public member profiles.');
expect(rootLayout.includes("if (!auth.userId && !isGuestPublicPath(pathname)) return <Redirect href=\"/\" />"), 'Logged-out protected/internal links must redirect to homepage.');
expect(rootLayout.includes('Đăng ký |') && rootLayout.includes('Đăng nhập |') && rootLayout.includes('Điều khoản |') && rootLayout.includes('Tiêu chuẩn cộng đồng |'), 'Browser titles must cover auth and legal public pages.');

expect(netlifySeo.includes("path: ['/', '/auth', '/auth/*', '/legal/*', '/thanh-vien/*']"), 'Netlify Edge SEO must cover all requested public/shareable routes.');
expect(netlifySeo.includes('context.next()'), 'Netlify Edge SEO must decorate the canonical Expo Web response rather than introduce a second web app.');
expect(netlifySeo.includes('public-profile-seo') && netlifySeo.includes('profile.avatar_url'), 'Member crawler metadata must resolve safe public data and use the member-specific avatar returned by Supabase.');
expect(netlifySeo.includes('og:title') && netlifySeo.includes('og:image') && netlifySeo.includes('twitter:image') && netlifySeo.includes('canonical'), 'Crawler response must include Open Graph, Twitter/X and canonical metadata.');
expect(netlifySeo.includes(description), 'Crawler response must use the approved SEO description.');
expect(!netlifySeo.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Netlify Edge SEO must never contain or require the Supabase service-role key.');

expect(supabaseSeo.includes("server.rpc('get_public_chon_profile'"), 'Public SEO metadata endpoint must reuse the safe public-profile contract.');
expect(supabaseSeo.includes('display_name') && supabaseSeo.includes('public_profile_code') && supabaseSeo.includes('avatar_url'), 'Public SEO endpoint must return only the minimal member metadata required for sharing.');
expect(!supabaseSeo.includes(".from('profiles').select"), 'Public SEO endpoint must not bypass the safe public-profile RPC to expose profile rows.');
expect(supabaseConfig.includes('[functions.public-profile-seo]') && supabaseConfig.includes('verify_jwt = false'), 'Public SEO metadata endpoint must be explicitly configured for crawler access.');

expect(browserTest.includes(`Đăng nhập | ${titleSuffix}`), 'Browser accessibility test must assert the new login title contract.');
expect(packageJson.scripts?.['validate:seo-public-profile'] === 'node scripts/validate-seo-public-profile.mjs', 'package.json must expose the public profile SEO validator.');
expect(packageJson.scripts?.validate?.includes('validate:seo-public-profile'), 'Aggregate validation must include public profile SEO.');
expect(ci.includes('pnpm validate:seo-public-profile'), 'Application CI must execute public profile SEO validation.');

if (errors.length) {
  console.error('Chọn.love public profile SEO validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.warn('Chọn.love public profile SEO validation passed: public id routes, member-specific social images, public-page metadata, and guest route protection are present.');