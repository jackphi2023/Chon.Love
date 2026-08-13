import { readFileSync } from 'node:fs';
const read=(path)=>readFileSync(path,'utf8');
const noMyFanOrPhase=['apps/mobile/app/chat/[conversationId].tsx','apps/mobile/app/profile/[username].tsx','apps/mobile/app/legal/terms.tsx','apps/mobile/app/legal/community-standards.tsx','apps/mobile/app/auth/forgot-password.tsx','apps/mobile/app/settings/account-deletion.tsx','apps/mobile/app/settings/private-photos.tsx','apps/mobile/app/settings/gifts.tsx','apps/mobile/app/settings/membership.tsx','apps/mobile/app/(tabs)/balance.tsx','apps/mobile/app/(tabs)/gifts.tsx','apps/mobile/app/(tabs)/friends.tsx','apps/mobile/app/payments/vietqr.tsx','apps/mobile/app/creator/index.tsx','apps/mobile/src/components/luxy-search-mobile.tsx','apps/mobile/src/components/luxy-search-desktop.tsx','apps/mobile/src/components/luxy-upgrade-gate-modal.tsx','apps/mobile/src/components/app-error-boundary.tsx','apps/mobile/src/lib/location-errors.ts','apps/mobile/src/lib/onboarding.ts','packages/config/src/index.ts','packages/validation/src/index.ts','apps/admin/app/layout.tsx','apps/admin/app/admin-login.tsx'];
const searchSurfaces=['apps/mobile/src/components/luxy-search-mobile.tsx','apps/mobile/src/components/luxy-search-desktop.tsx'];
const publicReachable=['apps/public-web/app/layout.tsx','apps/public-web/app/page.tsx','apps/public-web/app/about/page.tsx','apps/public-web/app/how-it-works/page.tsx','apps/public-web/app/manifest.ts','apps/public-web/app/[profileSlug]/page.tsx'];
const failures=[];
for(const path of noMyFanOrPhase){const text=read(path);if(/MyFan/.test(text))failures.push(`${path}: legacy MyFan copy remains`);if(/LX-[0-9]{2}/.test(text))failures.push(`${path}: internal LX phase label remains user-facing`);if(/Album Fan/.test(text))failures.push(`${path}: legacy Album Fan copy remains`)}
for(const path of searchSurfaces){if(/Hoạt động gần đây/.test(read(path)))failures.push(`${path}: legacy Activity-style recent label remains`)}
for(const path of publicReachable){const text=read(path);for(const[label,pattern]of[['MyFan',/MyFan/],['Creator',/Creator/],['Fan',/\bFan\b/],['Hoạt động',/Hoạt động/],['Social Creator',/Social Creator/]])if(pattern.test(text))failures.push(`${path}: legacy public-web term ${label} remains`)}
const home=read('apps/public-web/app/page.tsx');const layout=read('apps/public-web/app/layout.tsx');const manifest=read('apps/public-web/app/manifest.ts');const ui=read('packages/ui/src/index.ts');const next=read('apps/public-web/next.config.ts');const netlify=read('apps/public-web/netlify.toml');const protectedTabs=read('apps/mobile/app/(tabs)/_layout.tsx');const mobileConfig=read('apps/mobile/app.json');const mobileHtml=read('apps/mobile/app/+html.tsx');const buildScript=read('scripts/build-chon-netlify.mjs');const readme=read('README.md');const rootPackage=read('package.json');
const exactTitle='Chon.Love | Chọn đúng người, Yêu đúng Gu';const exactDescription='Chon.Love là nền tảng hẹn hò dành cho người dùng thật và văn minh, hướng tới các mối quan hệ lành mạnh, chất lượng và xứng tầm.';
if(!home.includes(exactTitle)||!layout.includes(exactTitle)||!manifest.includes(exactTitle))failures.push('Chon.Love homepage/manifest title contract missing');
if(!home.includes(exactDescription)||!layout.includes(exactDescription)||!manifest.includes(exactDescription))failures.push('Chon.Love description contract missing');
if(!readme.startsWith('# Chon.Love — Web V1'))failures.push('README must describe the current Chon.Love Web V1 product');
if(!readme.includes(exactTitle)||!readme.includes(exactDescription))failures.push('README must preserve the canonical Chon.Love SEO title and description');
if(!readme.includes('Activity/Creator feed không thuộc Chon.Love Web V1.'))failures.push('README must keep Activity/Creator feed out of the Web V1 scope');
if(/# MyFan/.test(readme)||/Social Creator 18\+/.test(readme))failures.push('README reverted to a legacy MyFan product description');
if(!rootPackage.includes('"description": "Chon.Love Web V1 monorepo'))failures.push('Root package must describe the current Chon.Love monorepo');
if(!ui.includes("productName:'Chon.Love'"))failures.push('Shared authenticated brand must be Chon.Love');
if(!mobileConfig.includes('"name": "Chon.Love"')||!mobileHtml.includes(exactTitle))failures.push('Authenticated Expo Web metadata must use Chon.Love branding');
if(next.includes("output: 'export'"))failures.push('Public web must not use static export because shareable member profiles need dynamic metadata');
if(!netlify.includes('apps/public-web/.next'))failures.push('Public web Netlify publish directory must use the Next.js .next output');
if(!netlify.includes('pnpm build:netlify:chon'))failures.push('Netlify must build the combined Chon.Love public and authenticated web release');
if(!netlify.includes('from = "/app/*"')||!netlify.includes('to = "/app/index.html"'))failures.push('Netlify must preserve SPA routing for the embedded authenticated app');
if(!buildScript.includes("EXPO_PUBLIC_WEB_BASE_URL: appBasePath")||!buildScript.includes("NEXT_PUBLIC_APP_URL: appOrigin"))failures.push('Combined Netlify build must host authenticated Expo routes under /app');
if(!layout.includes('href={loginUrl}')||!layout.includes('href={signupUrl}'))failures.push('Public header auth CTAs must link directly to the authenticated app');
if(!protectedTabs.includes('<Redirect href="/"/>'))failures.push('Unauthenticated member-list access must return to the homepage');
if(failures.length){console.error('WEB-R03/SEO branding validation failed:\n'+failures.map(x=>`- ${x}`).join('\n'));process.exit(1)}
console.warn('WEB-R03/SEO validation passed: Chon.Love branding, repository baseline, embedded /app auth routing, shareable profile runtime and member-list guards are intact.');
