import { existsSync, readFileSync } from 'node:fs';
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
  'apps/mobile/src/screens/chon-member-profile-screen.tsx',
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
  'apps/admin/app/runtime-observability/page.tsx',
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

// UI-ASSET01 owns the canonical membership artwork. Validate every source file
// byte-structurally and by its exact natural dimensions instead of relying on the
// retired Luxy 768x528 certification canvas.
for (const [path, width, height] of [
  ['apps/mobile/assets/chon/membership-badges/premium-16.png', 29, 40],
  ['apps/mobile/assets/chon/membership-badges/premium-26.png', 33, 46],
  ['apps/mobile/assets/chon/membership-badges/premium-160.png', 179, 199],
  ['apps/mobile/assets/chon/membership-badges/diamond-16.png', 31, 41],
  ['apps/mobile/assets/chon/membership-badges/diamond-26.png', 38, 50],
  ['apps/mobile/assets/chon/membership-badges/diamond-160.png', 180, 208],
]) {
  validatePng(path, width, height);
}

const membershipBadge = read('apps/mobile/src/components/chon-membership-badge.tsx');
const membershipBadgeAssets = read('apps/mobile/src/components/chon-membership-badge-assets.ts');
const membershipBadgeSizing = read('apps/mobile/src/components/chon-ui-sizing.ts');

for (const assetName of [
  'premium-16.png',
  'premium-26.png',
  'premium-160.png',
  'diamond-16.png',
  'diamond-26.png',
  'diamond-160.png',
]) {
  expect(
    membershipBadgeAssets.includes(assetName),
    `UI-ASSET01 resolver must own ${assetName}.`,
  );
}
expect(
  membershipBadge.includes('resolveChonMembershipBadgeAsset') && membershipBadge.includes('resizeMode="contain"'),
  'Chọn.Love membership badge renderer must delegate source/geometry to the UI-ASSET01 resolver and contain artwork without crop/stretch.',
);
expect(
  membershipBadgeSizing.includes('CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_MOBILE = 16') &&
    membershipBadgeSizing.includes('CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_DESKTOP = 26'),
  'UI-ASSET01 compact membership badges must keep canonical 16px mobile / 26px desktop rendered heights.',
);
expect(
  !membershipBadge.includes('premium-badge-hq.png') && !membershipBadge.includes('diamond-badge-hq.png'),
  'Canonical Chọn.Love badge renderer must not import retired Luxy HQ membership artwork.',
);
expect(
  !membershipBadgeAssets.includes('assets/luxy/'),
  'UI-ASSET01 asset resolver must not route membership presentation through legacy Luxy asset paths.',
);
expect(
  !existsSync('apps/mobile/src/components/luxy-membership-badge-image.web.tsx'),
  'Duplicate legacy Web membership badge renderer must stay removed; platform presentation belongs to Chọn.Love.',
);

const badgeBridge = read('apps/mobile/src/components/luxy-membership-badge-image.tsx');
expect(
  badgeBridge.includes("from './chon-membership-badge'") && badgeBridge.includes('<ChonMembershipBadge'),
  'Legacy membership badge bridge must delegate to the canonical Chọn.Love owner.',
);
expect(
  !badgeBridge.includes('premium-badge-hq.png') && !badgeBridge.includes('diamond-badge-hq.png'),
  'Legacy membership badge bridge must not duplicate canonical artwork ownership.',
);

const profileBadgeE2e = read('tests/br-06/chon-public-member-profile-pro01.spec.mjs');
expect(
  profileBadgeE2e.includes('displayHeight: 16') && profileBadgeE2e.includes('displayHeight: 26'),
  'UI-PRO01 browser regression must enforce UI-ASSET01 16px/26px compact badge heights.',
);
expect(
  profileBadgeE2e.includes('naturalWidth: 29') && profileBadgeE2e.includes('naturalHeight: 40') &&
    profileBadgeE2e.includes('naturalWidth: 31') && profileBadgeE2e.includes('naturalHeight: 41') &&
    profileBadgeE2e.includes('naturalWidth: 33') && profileBadgeE2e.includes('naturalHeight: 46') &&
    profileBadgeE2e.includes('naturalWidth: 38') && profileBadgeE2e.includes('naturalHeight: 50'),
  'UI-PRO01 browser regression must decode the tier/context-specific approved compact PNG sources.',
);
expect(
  profileBadgeE2e.includes("getByTestId('chon-member-profile-hero-photo')") && profileBadgeE2e.includes('chon-membership-badge-image-'),
  'UI-PRO01 browser regression must keep the canonical badge source inside the Chọn.Love hero frame.',
);

const connectBadgeE2e = read('tests/br-06/chon-connect-c01.spec.mjs');
expect(
  connectBadgeE2e.includes('mobileBadgeBox.height - 16') && connectBadgeE2e.includes('desktopBadgeBox.height - 26'),
  'UI-C01 browser regression must enforce compact mobile/desktop badge heights.',
);
expect(
  connectBadgeE2e.includes('not.toBe(mobileBadgeSource)'),
  'UI-C01 browser regression must prove mobile and desktop cards route to different approved source assets.',
);

const membershipBadgeE2e = read('tests/br-06/chon-membership-mem01.spec.mjs');
expect(
  membershipBadgeE2e.includes('premiumMobileSource') && membershipBadgeE2e.includes('diamondDesktopSource'),
  'UI-MEM01 browser regression must cover Premium and Diamond certificate source routing.',
);

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
console.warn('Chon.Love branding/source-of-truth validation passed: current Expo Web + Admin UI are canonical, unreleased Admin finance placeholders stay out of navigation, UI-ASSET01 membership PNGs are intact and centrally routed, Chọn.Love owns the profile badge contract, and legacy Activity/Creator routes are retired.');
