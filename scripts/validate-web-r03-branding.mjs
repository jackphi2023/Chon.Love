import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
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

const canonicalMembershipAssets = [
  {
    path: 'apps/mobile/assets/luxy/chonlove-premium.png',
    width: 480,
    height: 320,
    sha256: '703166bb21db2d547fda6f6525c1a87cf7872b85cba2e44561bc66d35216603b',
  },
  {
    path: 'apps/mobile/assets/luxy/chonlove-diamond.png',
    width: 480,
    height: 320,
    sha256: 'cc7e1cc533e0433b0681356ceb33eeb99acd432f9f276387d7e349febc40a442',
  },
];

for (const asset of canonicalMembershipAssets) {
  validatePng(asset.path, asset.width, asset.height);
  const actualSha256 = createHash('sha256').update(readBuffer(asset.path)).digest('hex');
  expect(actualSha256 === asset.sha256, `${asset.path}: canonical artwork SHA-256 changed; do not redraw, regenerate, restyle, crop, stretch, or substitute this badge.`);
}

const retiredMembershipAssets = new Set([
  'premium-badge.png',
  'premium-badge-hq.png',
  'diamond-badge.png',
  'diamond-badge-hq.png',
]);
const membershipAssetNames = readdirSync('apps/mobile/assets/luxy');
for (const retired of retiredMembershipAssets) {
  expect(!membershipAssetNames.includes(retired), `apps/mobile/assets/luxy/${retired}: retired ambiguous membership artwork must not return.`);
}

const badgeManifest = read('apps/mobile/assets/luxy/CANONICAL_MEMBERSHIP_BADGES.md');
for (const hash of [
  '70eed4c9bc1080756e1bf7d4d44bfb1625b2b198ec62dd33c9a91a62041c2e11',
  '4514f67e9da17214bcbebd81ca900994007a48a6b55bc71d4cf255fed3604ffd',
  'cc7e1cc533e0433b0681356ceb33eeb99acd432f9f276387d7e349febc40a442',
  '703166bb21db2d547fda6f6525c1a87cf7872b85cba2e44561bc66d35216603b',
]) {
  expect(badgeManifest.includes(hash), 'Canonical membership badge manifest must preserve source and runtime provenance hashes.');
}

for (const path of [
  'apps/mobile/src/components/luxy-membership-badge-image.tsx',
  'apps/mobile/src/components/luxy-membership-badge-image.web.tsx',
]) {
  const membershipBadge = read(path);
  expect(
    membershipBadge.includes('BADGE_ASPECT_WIDTH = 3') && membershipBadge.includes('BADGE_ASPECT_HEIGHT = 2'),
    `${path}: membership badge layout must preserve the user-supplied 3:2 artwork ratio.`,
  );
  expect(
    membershipBadge.includes('chonlove-premium.png') && membershipBadge.includes('chonlove-diamond.png'),
    `${path}: membership presentation must use only the canonical user-supplied artwork derivatives.`,
  );
  expect(membershipBadge.includes('resizeMode="contain"'), `${path}: membership artwork must use contain mode and must never crop.`);
  expect(!/premium-badge|diamond-badge|16:11|768×528/.test(membershipBadge), `${path}: reconstructed legacy badge references or stale 16:11 geometry must not return.`);
}

const badgeE2e = read('tests/br-06/luxy-profile-visual-regressions.spec.mjs');
expect(badgeE2e.includes("tier: 'premium'") && badgeE2e.includes("tier: 'diamond'"), 'Browser regression must exercise both Premium and Diamond badges.');
expect(badgeE2e.includes('await node.decode()') && badgeE2e.includes('natural height`).toBe(320)') && badgeE2e.includes('natural width`).toBe(480)'), 'Browser regression must require complete decoding of the 480×320 canonical runtime assets.');
expect(badgeE2e.includes("createHash('sha256')") && badgeE2e.includes('canonicalMembershipSha256'), 'Browser regression must verify the exact SHA-256 bytes loaded by Chromium.');
expect(badgeE2e.includes('expectedWidth * 2') && badgeE2e.includes('/ 3') && badgeE2e.includes("getByTestId('luxy-member-profile-hero-photo')"), 'Browser regression must enforce the 3:2 rendered ratio and keep the badge inside the hero frame.');
expect(badgeE2e.includes("objectFit, `${tier} artwork should not be cropped`).toBe('contain')"), 'Browser regression must prove membership artwork is rendered with contain and not cropped.');

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
console.warn('Chon.Love branding/source-of-truth validation passed: current Expo Web + Admin UI are canonical, membership artwork is checksum-locked to the approved user-supplied 3:2 badges, native/Web use contain without cropping, and retired legacy surfaces remain excluded.');
