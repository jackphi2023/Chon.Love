import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const read = (path) => readFileSync(path, 'utf8');
const readBuffer = (path) => readFileSync(path);
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const userFacing = [
  'apps/mobile/app/index.tsx',
  'apps/mobile/app/(auth)/index.tsx',
  'apps/mobile/app/chat/[conversationId].tsx',
  'apps/mobile/app/profile/[username].tsx',
  'apps/mobile/app/thanh-vien/[username].tsx',
  'apps/mobile/src/screens/luxy-member-profile-screen.tsx',
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
  'apps/admin/app/layout.tsx',
  'apps/admin/app/admin-login.tsx',
  'apps/admin/app/(protected)/layout.tsx',
  'apps/admin/app/(protected)/withdrawals/page.tsx',
  'apps/admin/app/kyc-withdrawal-operations/page.tsx',
  'apps/admin/app/vietqr-reconciliation/page.tsx',
];

for (const path of userFacing) {
  const text = read(path);
  if (/MyFan/.test(text)) failures.push(`${path}: user-facing MyFan branding remains`);
  if (/Luxy\.Love/.test(text)) failures.push(`${path}: user-facing Luxy.Love branding remains`);
  if (/Social Creator/.test(text)) failures.push(`${path}: legacy Social Creator positioning remains`);
  if (/Album Fan/.test(text)) failures.push(`${path}: legacy Album Fan copy remains`);
}

const adminNavigation = read('apps/admin/app/(protected)/layout.tsx');
expect(adminNavigation.includes("['Gói thành viên', '/memberships']"), 'Admin navigation must retain the real membership approval workflow.');
expect(adminNavigation.includes("['Đối soát VietQR', '/vietqr-reconciliation']"), 'Admin navigation must retain the real VietQR reconciliation workflow.');
expect(adminNavigation.includes("['KYC & rút tiền', '/withdrawals']"), 'Admin navigation must retain the real BR-08 KYC/withdrawal workflow.');
expect(!adminNavigation.includes("['Gifts', '/gifts']"), 'Unreleased Gift Admin placeholder must not be linked from production navigation.');
expect(!adminNavigation.includes("['Payments', '/payments']"), 'Unreleased Payments Admin placeholder must not be linked from production navigation.');

const activityRoutes = [
  'apps/mobile/app/(tabs)/activity.tsx',
  'apps/mobile/app/activity/[username].tsx',
  'apps/mobile/app/activity/create.tsx',
];
for (const path of activityRoutes) {
  const text = read(path);
  expect(text.includes("import { Redirect } from 'expo-router'"), `${path}: retired Activity route must remain a safe redirect.`);
  expect(!/CreatorActivity|createCreator|listCreator/i.test(text), `${path}: retired Activity route must not import legacy Activity runtime.`);
}

const creatorRoute = read('apps/mobile/app/creator/index.tsx');
expect(creatorRoute.includes("import { Redirect } from 'expo-router'"), 'Legacy /creator route must be a safe redirect, not a placeholder product surface.');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePng(path, expectedWidth, expectedHeight) {
  const data = readBuffer(path);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(data.subarray(0, 8).equals(signature), `${path}: invalid PNG signature.`);
  if (!data.subarray(0, 8).equals(signature)) return;

  let offset = 8;
  let width = 0;
  let height = 0;
  let sawIend = false;
  const idat = [];
  try {
    while (offset < data.length) {
      if (offset + 12 > data.length) throw new Error('truncated chunk header');
      const length = data.readUInt32BE(offset);
      const type = data.subarray(offset + 4, offset + 8);
      const payloadStart = offset + 8;
      const payloadEnd = payloadStart + length;
      const crcOffset = payloadEnd;
      if (crcOffset + 4 > data.length) throw new Error(`truncated ${type.toString('ascii')} chunk`);
      const payload = data.subarray(payloadStart, payloadEnd);
      const expectedCrc = data.readUInt32BE(crcOffset);
      const actualCrc = crc32(Buffer.concat([type, payload]));
      if (actualCrc !== expectedCrc) throw new Error(`${type.toString('ascii')} CRC mismatch`);

      const chunkType = type.toString('ascii');
      if (chunkType === 'IHDR') {
        width = payload.readUInt32BE(0);
        height = payload.readUInt32BE(4);
      } else if (chunkType === 'IDAT') {
        idat.push(payload);
      } else if (chunkType === 'IEND') {
        sawIend = true;
        offset = crcOffset + 4;
        break;
      }
      offset = crcOffset + 4;
    }
    if (!sawIend) throw new Error('missing IEND');
    if (offset !== data.length) throw new Error('unexpected trailing bytes');
    if (idat.length === 0) throw new Error('missing IDAT');
    inflateSync(Buffer.concat(idat));
  } catch (error) {
    failures.push(`${path}: corrupt/truncated PNG (${error instanceof Error ? error.message : String(error)}).`);
    return;
  }

  expect(width === expectedWidth, `${path}: expected ${expectedWidth}px natural width, found ${width}px.`);
  expect(height === expectedHeight, `${path}: expected ${expectedHeight}px natural height, found ${height}px.`);
}

for (const path of [
  'apps/mobile/assets/luxy/premium-badge-hq.png',
  'apps/mobile/assets/luxy/diamond-badge-hq.png',
]) {
  validatePng(path, 768, 528);
}

for (const path of [
  'apps/mobile/src/components/luxy-membership-badge-image.tsx',
  'apps/mobile/src/components/luxy-membership-badge-image.web.tsx',
]) {
  const membershipBadge = read(path);
  expect(
    membershipBadge.includes('BADGE_ASPECT_WIDTH = 16') && membershipBadge.includes('BADGE_ASPECT_HEIGHT = 11'),
    `${path}: membership badge layout must preserve the canonical 16:11 artwork ratio.`,
  );
  expect(
    membershipBadge.includes("premium-badge-hq.png") && membershipBadge.includes("diamond-badge-hq.png"),
    `${path}: membership presentation must use both validated HQ raster assets.`,
  );
  expect(
    !membershipBadge.includes('(width * 2) / 3'),
    `${path}: stale 3:2 membership badge sizing must not return.`,
  );
}

const badgeE2e = read('tests/br-06/luxy-profile-visual-regressions.spec.mjs');
expect(badgeE2e.includes("tier: 'premium'") && badgeE2e.includes("tier: 'diamond'"), 'Browser regression must exercise both Premium and Diamond badges.');
expect(badgeE2e.includes('await node.decode()') && badgeE2e.includes('natural height`).toBe(528)'), 'Browser regression must require complete image decoding and the 768×528 natural canvas.');
expect(badgeE2e.includes('expectedWidth * 11') && badgeE2e.includes("getByTestId('luxy-member-profile-hero-photo')"), 'Browser regression must enforce 16:11 rendered height and keep the badge inside the hero frame.');

const mobileHtml = read('apps/mobile/app/+html.tsx');
const ui = read('packages/ui/src/index.ts');
const rootNetlify = read('netlify.toml');
const netlifyBuildScript = read('scripts/build-netlify-web.sh');
const packageJson = JSON.parse(read('package.json'));
const exactTitle = 'Trang chủ | Chọn.love - Chọn đúng Người, Yêu đúng Gu';
expect(mobileHtml.includes(exactTitle), 'Expo Web metadata must use the current Chọn.love SEO title contract.');
expect(ui.includes("productName:'Chon.Love'") || ui.includes("productName: 'Chon.Love'"), 'Shared authenticated brand must be Chon.Love.');
expect(rootNetlify.includes('command = "bash scripts/build-netlify-web.sh"'), 'Root Netlify must use the canonical combined Chon.Love build script.');
expect(netlifyBuildScript.includes('pnpm --filter @myfan/mobile build:web'), 'Canonical Netlify build script must build the Chon.Love Expo Web app.');
expect(netlifyBuildScript.includes('pnpm --filter @myfan/admin build'), 'Canonical Netlify build script must build the Chon.Love Admin app.');
expect(!rootNetlify.includes('build:netlify:chon') && !rootNetlify.includes('apps/public-web/.next'), 'Root Netlify must not reference the retired combined public-web release.');
expect(!netlifyBuildScript.includes('apps/public-web'), 'Canonical Netlify build script must not revive the retired public-web app.');
expect(!packageJson.scripts?.['build:netlify:chon'], 'package.json must not expose the retired combined build script.');

if (failures.length) {
  console.error(`Chon.Love branding/source-of-truth validation failed:\n${failures.map((x) => `- ${x}`).join('\n')}`);
  process.exit(1);
}
console.warn('Chon.Love branding/source-of-truth validation passed: current Expo Web + Admin UI are canonical, unreleased Admin finance placeholders stay out of navigation, membership PNGs are intact, native/Web badge renderers preserve 16:11, and legacy Activity/Creator routes are retired.');