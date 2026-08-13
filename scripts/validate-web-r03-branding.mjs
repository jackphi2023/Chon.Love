import { readFileSync } from 'node:fs';

const noMyFanOrPhase = [
  'apps/mobile/app/chat/[conversationId].tsx',
  'apps/mobile/app/profile/[username].tsx',
  'apps/mobile/app/legal/terms.tsx',
  'apps/mobile/app/legal/community-standards.tsx',
  'apps/mobile/app/auth/forgot-password.tsx',
  'apps/mobile/app/settings/account-deletion.tsx',
  'apps/mobile/app/settings/private-photos.tsx',
  'apps/mobile/app/settings/gifts.tsx',
  'apps/mobile/app/settings/membership.tsx',
  'apps/mobile/app/(tabs)/balance.tsx',
  'apps/mobile/app/(tabs)/gifts.tsx',
  'apps/mobile/app/(tabs)/friends.tsx',
  'apps/mobile/app/payments/vietqr.tsx',
  'apps/mobile/app/creator/index.tsx',
  'apps/mobile/src/components/luxy-search-mobile.tsx',
  'apps/mobile/src/components/luxy-search-desktop.tsx',
  'apps/mobile/src/components/luxy-upgrade-gate-modal.tsx',
  'apps/mobile/src/components/app-error-boundary.tsx',
  'apps/mobile/src/lib/location-errors.ts',
  'apps/mobile/src/lib/onboarding.ts',
  'packages/config/src/index.ts',
  'packages/validation/src/index.ts',
  'apps/admin/app/layout.tsx',
  'apps/admin/app/admin-login.tsx',
];

const searchSurfaces = [
  'apps/mobile/src/components/luxy-search-mobile.tsx',
  'apps/mobile/src/components/luxy-search-desktop.tsx',
];

const publicReachable = [
  'apps/public-web/app/layout.tsx',
  'apps/public-web/app/page.tsx',
  'apps/public-web/app/terms/page.tsx',
  'apps/public-web/app/community-standards/page.tsx',
  'apps/public-web/app/qua-tang/page.tsx',
  'apps/public-web/app/hoat-dong/page.tsx',
  'apps/public-web/app/manifest.ts',
];

const failures = [];
for (const path of noMyFanOrPhase) {
  const text = readFileSync(path, 'utf8');
  if (/MyFan/.test(text)) failures.push(`${path}: legacy MyFan copy remains`);
  if (/LX-[0-9]{2}/.test(text)) failures.push(`${path}: internal LX phase label remains user-facing`);
  if (/Album Fan/.test(text)) failures.push(`${path}: legacy Album Fan copy remains`);
}
for (const path of searchSurfaces) {
  const text = readFileSync(path, 'utf8');
  if (/Hoạt động gần đây/.test(text)) failures.push(`${path}: legacy Activity-style recent label remains`);
}
for (const path of publicReachable) {
  const text = readFileSync(path, 'utf8');
  for (const [label, pattern] of [
    ['MyFan', /MyFan/],
    ['Creator', /Creator/],
    ['Fan', /\bFan\b/],
    ['Hoạt động', /Hoạt động/],
    ['Social Creator', /Social Creator/],
  ]) {
    if (pattern.test(text)) failures.push(`${path}: legacy public-web term ${label} remains`);
  }
}

if (failures.length) {
  console.error('WEB-R03 branding validation failed:\n' + failures.map((x) => `- ${x}`).join('\n'));
  process.exit(1);
}
console.warn('WEB-R03 branding validation passed: reachable Web V1 surfaces use Luxy.Love copy, neutral recent-access wording, and no LX phase labels.');
