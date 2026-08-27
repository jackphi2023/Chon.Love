import { existsSync, readFileSync, statSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

const description = 'Chon.Love là nền tảng hẹn hò dành cho người dùng thật và văn minh, hướng tới các mối quan hệ lành mạnh, chất lượng và xứng tầm';
const titleSuffix = 'Chọn.love - Chọn đúng Người, Yêu đúng Gu';
const productionOrigin = 'https://www.chon.love';
const homepageThumbnailPath = 'apps/mobile/public/seo/chonlove-homepage-thumbnail.jpg';
const homepageThumbnailUrl = `${productionOrigin}/seo/chonlove-homepage-thumbnail.jpg`;
const rootLayout = read('apps/mobile/app/_layout.tsx');
const rootHtml = read('apps/mobile/app/+html.tsx');
const publicRoute = read('apps/mobile/app/thanh-vien/[username].tsx');
const canonicalProfileLayout = read('apps/mobile/app/thanh-vien/_layout.tsx');
const legacyRoute = read('apps/mobile/app/profile/[username].tsx');
const sharedProfileLayout = read('apps/mobile/app/profile/_layout.tsx');
const richProfileScreen = read('apps/mobile/src/screens/chon-member-profile-screen.tsx');
const legacyRichProfileBridge = read('apps/mobile/src/screens/luxy-member-profile-screen.tsx');
const verificationBadgesWeb = read('apps/mobile/src/components/member-profile-verification-badges.web.tsx');
const mobileActionsWeb = read('apps/mobile/src/components/member-profile-mobile-actions.web.tsx');
const sharedPublicProfile = read('packages/supabase/src/public-profile.ts');
const memberProfileClient = read('packages/supabase/src/member-profile.ts');
const sharedIndex = read('packages/supabase/src/index.ts');
const routeMigration = read('supabase/migrations/20260819153018_chon_public_member_route_resolution.sql');
const viewerCompatMigration = read('supabase/migrations/20260819153533_chon_profile_viewer_public_id_compat.sql');
const netlifySeo = read('netlify/edge-functions/seo.ts');
const netlifyBuild = read('scripts/build-netlify-web.sh');
const supabaseSeo = read('supabase/functions/public-profile-seo/index.ts');
const supabaseConfig = read('supabase/config.toml');
const browserTest = read('tests/br-09/observability-accessibility-resilience.spec.mjs');
const homepageBrowserTest = read('tests/br-06/luxy-public-homepage.spec.mjs');
const packageJson = JSON.parse(read('package.json'));
const ci = read('.github/workflows/ci.yml');

expect(existsSync(homepageThumbnailPath), 'Dedicated homepage social thumbnail must be committed.');
if (existsSync(homepageThumbnailPath)) {
  const size = statSync(homepageThumbnailPath).size;
  expect(size > 10_000 && size < 1_000_000, 'Homepage social thumbnail must be a non-trivial optimized production image below 1MB.');
}

expect(rootHtml.includes(description), 'Default HTML metadata must use the approved SEO description.');
expect(rootHtml.includes(homepageThumbnailUrl), 'Default HTML metadata must use the dedicated homepage social thumbnail on the production www.chon.love domain.');
expect(rootHtml.includes('og:title') && rootHtml.includes('og:description') && rootHtml.includes('og:image'), 'Default HTML must expose Open Graph metadata.');
expect(rootHtml.includes('twitter:card') && rootHtml.includes('twitter:image'), 'Default HTML must expose Twitter/X card metadata.');
expect(rootHtml.includes('og:image:width') && rootHtml.includes('content="480"') && rootHtml.includes('og:image:height') && rootHtml.includes('content="360"'), 'Default HTML metadata must publish the optimized homepage thumbnail dimensions.');
expect(rootHtml.includes(`Trang chủ | ${titleSuffix}`), 'Homepage must use the requested title convention.');

expect(sharedPublicProfile.includes('/^id-([0-9a-f]{6})$/u'), 'Public member route IDs must use id-xxxxxx public codes, never usernames or auth UUIDs.');
expect(sharedPublicProfile.includes("rpc('get_public_chon_profile'"), 'Public member data must come from the existing safe public profile RPC.');
expect(sharedPublicProfile.includes("rpc('resolve_chon_member_route'"), 'Authenticated compatibility must resolve legacy usernames to opaque public member codes.');
expect(sharedIndex.includes("export * from './public-profile';"), 'Shared Supabase entry point must export the public profile client.');
expect(memberProfileClient.includes('resolveChonMemberUsername'), 'Rich member profile client must resolve canonical id-xxxxxx routes without changing existing profile RPC contracts.');

expect(publicRoute.includes("useLocalSearchParams<{ username?"), 'Canonical member route must use a single dynamic segment while carrying id-xxxxxx as the value.');
expect(publicRoute.includes('publicProfileCodeFromRouteId'), 'Public profile screen must validate id-xxxxxx routes.');
expect(publicRoute.includes('publicProfileAvatarUrl'), 'Public profile screen must use the matching member avatar, not the global thumbnail.');
expect(publicRoute.includes('ChonMemberProfileScreen'), 'Signed-in canonical member route must preserve the complete rich profile experience through the Chọn.Love owner.');
expect(publicRoute.includes('`Thành viên ${profile.display_name} | ${TITLE_SUFFIX}`'), 'Public profile browser title must include the member display name.');
expect(!publicRoute.includes("pathname: '/profile/[username]'"), 'Canonical public profile screen must not navigate back to username URLs.');
expect(
  richProfileScreen.includes('getLuxyMemberProfile') &&
    richProfileScreen.includes('getProfileViewer') &&
    richProfileScreen.includes('blockUser') &&
    richProfileScreen.includes('createSafetyReport') &&
    richProfileScreen.includes('ChonPrivatePhotoAccess') &&
    richProfileScreen.includes('ChonFavoriteButton'),
  'Chọn.Love rich member screen must preserve profile, social, safety, favorite and private-photo behavior.',
);
expect(
  legacyRichProfileBridge.includes("export { default } from './chon-member-profile-screen';"),
  'Legacy rich-profile module must remain a minimal compatibility bridge to the canonical Chọn.Love owner.',
);

expect(canonicalProfileLayout.includes("export { default } from '../profile/_layout';"), 'Canonical member route must reuse the authenticated profile shell instead of silently dropping profile actions.');
expect(sharedProfileLayout.includes('if (!auth.userId) return <Slot />;'), 'Shared member profile shell must stay clean for logged-out public profile visitors.');
expect(sharedProfileLayout.includes('recordProfileViewByUsername(client, profile.username)'), 'Canonical profile views must keep analytics after resolving the opaque public ID to the existing username contract.');
expect(verificationBadgesWeb.includes('(?:profile|thanh-vien)'), 'Verification badges must activate on both legacy and canonical member routes.');
expect(verificationBadgesWeb.includes('getLuxyMemberVerificationBadges'), 'Verification sidecar must preserve the real server verification contract.');
expect(mobileActionsWeb.includes('(?:profile|thanh-vien)'), 'Mobile member actions and the Free upgrade prompt must activate on both legacy and canonical member routes.');
expect(verificationBadgesWeb.includes('chon-member-profile-hero-photo'), 'Verification sidecar must attach to the canonical Chọn.Love profile hero.');
expect(mobileActionsWeb.includes('chon-member-profile-page') && mobileActionsWeb.includes('chon-member-profile-message-composer'), 'Mobile profile sidecar must target the canonical Chọn.Love profile owner.');

expect(legacyRoute.includes('resolveChonMemberRoute') && legacyRoute.includes('router.replace(toPublicMemberPath(code))'), 'Legacy /profile/<username> route must canonicalize authenticated users to /thanh-vien/id-xxxxxx.');
expect(routeMigration.includes('resolve_chon_member_route') && routeMigration.includes('revoke all') && routeMigration.includes('to authenticated, service_role'), 'Legacy route resolver must be authenticated-only and avoid public username mapping.');
expect(viewerCompatMigration.includes("v_identifier ~ '^id-[0-9a-f]{6}$'"), 'Rich profile viewer must accept canonical public member IDs after routing migration.');

expect(rootLayout.includes("pathname.startsWith('/thanh-vien/')"), 'Guest routing must explicitly allow public member profiles.');
expect(rootLayout.includes("if (!auth.userId && !isGuestPublicPath(pathname)) return <Redirect href=\"/\" />"), 'Logged-out protected/internal links must redirect to homepage.');
expect(rootLayout.includes('Đăng ký |') && rootLayout.includes('Đăng nhập |') && rootLayout.includes('Điều khoản |') && rootLayout.includes('Tiêu chuẩn cộng đồng |'), 'Browser titles must cover auth and legal public pages.');

expect(netlifySeo.includes("'/thanh-vien/*'") && netlifySeo.includes("'/profile/*'"), 'Netlify Edge SEO must cover canonical member routes and reject legacy username routes.');
expect(netlifySeo.includes("url.pathname.startsWith('/profile/')") && netlifySeo.includes("Response.redirect(new URL('/', url), 302)"), 'Legacy username profile deep links must redirect guests/crawlers to homepage.');
expect(netlifySeo.includes(`const PRODUCTION_ORIGIN = '${productionOrigin}'`), 'Crawler metadata must canonicalize every public page to www.chon.love.');
expect(netlifySeo.includes("`${PRODUCTION_ORIGIN}/seo/chonlove-homepage-thumbnail.jpg`"), 'Netlify Edge SEO static pages must use the dedicated homepage thumbnail URL.');
expect(!netlifySeo.includes('/seo/chonlove-thumbnail.jpg'), 'Netlify Edge SEO must not use the retired global thumbnail.');
expect(netlifySeo.includes('imageUrl: STATIC_SOCIAL_IMAGE') && netlifySeo.includes('imageWidth: 480') && netlifySeo.includes('imageHeight: 360'), 'Netlify Edge SEO static metadata must publish the optimized homepage thumbnail and dimensions.');
expect(netlifyBuild.includes('apps/mobile/dist/seo/chonlove-homepage-thumbnail.jpg') && netlifyBuild.includes('[[ ! -s "${HOMEPAGE_SOCIAL_THUMBNAIL}" ]]'), 'Canonical Netlify build must fail if the homepage thumbnail is missing from the publish output.');
expect(netlifySeo.includes('context.next()'), 'Netlify Edge SEO must decorate the canonical Expo Web response rather than introduce a second web app.');
expect(netlifySeo.includes('public-profile-seo') && netlifySeo.includes('profile.avatar_url'), 'Member crawler metadata must resolve safe public data and use the member-specific avatar returned by Supabase.');
expect(netlifySeo.includes('og:title') && netlifySeo.includes('og:image') && netlifySeo.includes('twitter:image') && netlifySeo.includes('canonical'), 'Crawler response must include Open Graph, Twitter/X and canonical metadata.');
expect(netlifySeo.includes(description), 'Crawler response must use the approved SEO description.');
expect(!netlifySeo.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Netlify Edge SEO must never contain or require the Supabase service-role key.');

expect(supabaseSeo.includes("server.rpc('get_public_chon_profile'"), 'Public SEO metadata endpoint must reuse the safe public-profile contract.');
expect(supabaseSeo.includes("Deno.env.get('SUPABASE_ANON_KEY')"), 'Public SEO metadata endpoint must use the anonymous capability for its already-public RPC.');
expect(!supabaseSeo.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Public SEO metadata endpoint must not elevate crawlers to service-role privileges.');
expect(supabaseSeo.includes('display_name') && supabaseSeo.includes('public_profile_code') && supabaseSeo.includes('avatar_url'), 'Public SEO endpoint must return only the minimal member metadata required for sharing.');
expect(!supabaseSeo.includes(".from('profiles').select"), 'Public SEO endpoint must not bypass the safe public-profile RPC to expose profile rows.');
expect(supabaseConfig.includes('[functions.public-profile-seo]') && supabaseConfig.includes('verify_jwt = false'), 'Public SEO metadata endpoint must be explicitly configured for crawler access.');

expect(browserTest.includes(`Đăng nhập | ${titleSuffix}`), 'Browser accessibility test must assert the new login title contract.');
expect(homepageBrowserTest.includes(`const homepageSeoTitle = 'Trang chủ | ${titleSuffix}'`), 'BR-06 homepage browser test must assert the new SEO title instead of stale Chon.Love branding.');
expect(packageJson.scripts?.['validate:seo-public-profile'] === 'node scripts/validate-seo-public-profile.mjs', 'package.json must expose the public profile SEO validator.');
expect(packageJson.scripts?.validate?.includes('validate:seo-public-profile'), 'Aggregate validation must include public profile SEO.');
expect(ci.includes('pnpm validate:seo-public-profile'), 'Application CI must execute public profile SEO validation.');

if (errors.length) {
  console.error('Chọn.love public profile SEO validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.warn('Chọn.love public profile SEO validation passed: canonical id routes, Chọn.Love rich-profile ownership, legacy username redirects, shared authenticated profile shell, member-specific social images, optimized homepage thumbnail delivery, production-domain canonical metadata, least-privilege crawler metadata, public-page metadata, and guest route protection are present.');
