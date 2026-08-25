from pathlib import Path

ROOT = Path('.')


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}')
    target.write_text(text.replace(old, new, 1))


# One canonical size contract. Small member-card badges use exact small assets;
# profile and membership surfaces downscale only from the approved 160px source.
(ROOT / 'apps/mobile/src/components/chon-ui-sizing.ts').write_text('''// Canonical Chọn.Love web presentation sizes. Do not override these per screen.
// Keep artwork size separate from touch targets so accessibility targets remain >=44px.
export const CHON_ICON_SIZE_DESKTOP = 26;
export const CHON_ICON_SIZE_MOBILE = 18;
export const CHON_LOGO_HEIGHT_DESKTOP = 26;
export const CHON_LOGO_HEIGHT_MOBILE = 22;

// Approved membership badge contexts:
// - icon: dense member cards/lists (16px mobile / 26px desktop)
// - profile: public profile hero (48px mobile / 64px desktop)
// - certificate: Membership/Upgrade hero artwork (128px mobile / 160px desktop)
export const CHON_MEMBERSHIP_BADGE_ICON_WIDTH_MOBILE = 16;
export const CHON_MEMBERSHIP_BADGE_ICON_WIDTH_DESKTOP = 26;
export const CHON_MEMBERSHIP_BADGE_PROFILE_WIDTH_MOBILE = 48;
export const CHON_MEMBERSHIP_BADGE_PROFILE_WIDTH_DESKTOP = 64;
export const CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE = 128;
export const CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP = 160;

// Backward-compatible aliases for technical consumers not migrated yet.
export const CHON_MEMBERSHIP_BADGE_WIDTH_MOBILE = CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE;
export const CHON_MEMBERSHIP_BADGE_WIDTH_DESKTOP = CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP;
''')

(ROOT / 'apps/mobile/src/components/chon-membership-badge.tsx').write_text('''import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import {
  CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP,
  CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE,
  CHON_MEMBERSHIP_BADGE_ICON_WIDTH_DESKTOP,
  CHON_MEMBERSHIP_BADGE_ICON_WIDTH_MOBILE,
  CHON_MEMBERSHIP_BADGE_PROFILE_WIDTH_DESKTOP,
  CHON_MEMBERSHIP_BADGE_PROFILE_WIDTH_MOBILE,
} from './chon-ui-sizing';

type ApprovedBadgeTier = 'premium' | 'diamond';
type ApprovedBadgeRendition = 16 | 26 | 160;
type ApprovedBadgeAsset = {
  source: ImageSourcePropType;
  pixelWidth: number;
  pixelHeight: number;
  rendition: ApprovedBadgeRendition;
};

// UI-ASSET01 source of truth. Every require points to artwork cropped directly from
// the user-approved Chọn.Love badge board. Do not redraw or synthesize replacements.
const BADGE_ASSETS: Record<ApprovedBadgeTier, Record<ApprovedBadgeRendition, ApprovedBadgeAsset>> = {
  premium: {
    16: {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      source: require('../../assets/chon/membership-badges/premium-16.png'),
      pixelWidth: 29,
      pixelHeight: 40,
      rendition: 16,
    },
    26: {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      source: require('../../assets/chon/membership-badges/premium-26.png'),
      pixelWidth: 33,
      pixelHeight: 46,
      rendition: 26,
    },
    160: {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      source: require('../../assets/chon/membership-badges/premium-160.png'),
      pixelWidth: 179,
      pixelHeight: 199,
      rendition: 160,
    },
  },
  diamond: {
    16: {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      source: require('../../assets/chon/membership-badges/diamond-16.png'),
      pixelWidth: 31,
      pixelHeight: 41,
      rendition: 16,
    },
    26: {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      source: require('../../assets/chon/membership-badges/diamond-26.png'),
      pixelWidth: 38,
      pixelHeight: 50,
      rendition: 26,
    },
    160: {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      source: require('../../assets/chon/membership-badges/diamond-160.png'),
      pixelWidth: 180,
      pixelHeight: 208,
      rendition: 160,
    },
  },
};

export type ChonMembershipBadgeVariant = 'icon' | 'profile' | 'certificate';

export function getChonMembershipBadgeWidth(input: {
  desktop: boolean;
  variant: ChonMembershipBadgeVariant;
}): number {
  if (input.variant === 'icon') {
    return input.desktop
      ? CHON_MEMBERSHIP_BADGE_ICON_WIDTH_DESKTOP
      : CHON_MEMBERSHIP_BADGE_ICON_WIDTH_MOBILE;
  }
  if (input.variant === 'profile') {
    return input.desktop
      ? CHON_MEMBERSHIP_BADGE_PROFILE_WIDTH_DESKTOP
      : CHON_MEMBERSHIP_BADGE_PROFILE_WIDTH_MOBILE;
  }
  return input.desktop
    ? CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP
    : CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE;
}

export function getChonMembershipBadgeRendition(width: number): ApprovedBadgeRendition {
  if (width <= CHON_MEMBERSHIP_BADGE_ICON_WIDTH_MOBILE) return 16;
  if (width <= CHON_MEMBERSHIP_BADGE_ICON_WIDTH_DESKTOP) return 26;
  return 160;
}

export function ChonMembershipBadge({
  tier,
  desktop,
  variant = 'icon',
  inset = 2,
  width,
}: {
  // Public profile RPCs intentionally expose this field as a string. Keep the
  // runtime boundary defensive and render only the two paid tiers we support.
  tier: string | null | undefined;
  desktop: boolean;
  variant?: ChonMembershipBadgeVariant;
  inset?: number;
  width?: number;
}) {
  if (tier !== 'premium' && tier !== 'diamond') return null;
  const resolvedWidth = width ?? getChonMembershipBadgeWidth({ desktop, variant });
  const rendition = getChonMembershipBadgeRendition(resolvedWidth);
  const asset = BADGE_ASSETS[tier][rendition];
  const height = Math.round((resolvedWidth * asset.pixelHeight) / asset.pixelWidth);
  const label = tier === 'diamond' ? 'Thành viên Kim cương' : 'Thành viên Cao cấp';

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="image"
      pointerEvents="none"
      style={[styles.badge, { height, left: inset, top: inset, width: resolvedWidth }]}
      testID={`chon-membership-badge-${tier}`}
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={asset.source}
        style={styles.image}
        testID={`chon-membership-badge-${tier}-asset-${asset.rendition}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', zIndex: 6 },
  image: { height: '100%', width: '100%' },
});
''')

replace_once(
    'apps/mobile/src/components/chon-member-photo.tsx',
    "import { ChonMembershipBadge } from './chon-membership-badge';",
    "import { ChonMembershipBadge, type ChonMembershipBadgeVariant } from './chon-membership-badge';",
)
replace_once(
    'apps/mobile/src/components/chon-member-photo.tsx',
    "  badgeInset,\n  fallbackFontSize,",
    "  badgeInset,\n  membershipBadgeVariant = 'icon',\n  fallbackFontSize,",
)
replace_once(
    'apps/mobile/src/components/chon-member-photo.tsx',
    "  badgeInset?: number | undefined;\n  fallbackFontSize?: number | undefined;",
    "  badgeInset?: number | undefined;\n  membershipBadgeVariant?: ChonMembershipBadgeVariant | undefined;\n  fallbackFontSize?: number | undefined;",
)
replace_once(
    'apps/mobile/src/components/chon-member-photo.tsx',
    '        variant="icon"',
    '        variant={membershipBadgeVariant}',
)

replace_once(
    'apps/mobile/src/screens/chon-member-profile-screen.tsx',
    "              membershipTier={profile.membership_badge_visible ? profile.membership_tier : null}\n              name={displayName}",
    "              membershipTier={profile.membership_badge_visible ? profile.membership_tier : null}\n              membershipBadgeVariant=\"profile\"\n              name={displayName}",
)

replace_once(
    'apps/mobile/src/screens/chon-membership-screen.tsx',
    "  const copy = PLAN_COPY[tier];\n  return (\n    <View style={styles.planSection} testID={`plan-${tier}`}>\n      <View style={[styles.certificateStage, desktop && styles.certificateStageDesktop]}>\n        <ChonMembershipBadge desktop={desktop} inset={0} tier={tier} variant=\"certificate\" />\n      </View>",
    "  const copy = PLAN_COPY[tier];\n  const [badgeHovered, setBadgeHovered] = useState(false);\n  return (\n    <View style={styles.planSection} testID={`plan-${tier}`}>\n      <Pressable\n        accessible={false}\n        onHoverIn={() => setBadgeHovered(true)}\n        onHoverOut={() => setBadgeHovered(false)}\n        style={[\n          styles.certificateStage,\n          desktop && styles.certificateStageDesktop,\n          badgeHovered && styles.certificateStageHovered,\n        ]}\n        testID={`membership-badge-stage-${tier}`}\n      >\n        <ChonMembershipBadge desktop={desktop} inset={0} tier={tier} variant=\"certificate\" />\n      </Pressable>",
)
replace_once(
    'apps/mobile/src/screens/chon-membership-screen.tsx',
    "  certificateStage: { height: 91, marginBottom: 10, position: 'relative', width: 132 },\n  certificateStageDesktop: { height: 110, width: 160 },",
    "  certificateStage: { height: 152, marginBottom: 10, position: 'relative', width: 128 },\n  certificateStageDesktop: { height: 188, width: 160 },\n  certificateStageHovered: {\n    elevation: 6,\n    shadowColor: chonColors.goldStrong,\n    shadowOffset: { height: 6, width: 0 },\n    shadowOpacity: 0.32,\n    shadowRadius: 18,\n    transform: [{ scale: 1.035 }],\n  },",
)

replace_once(
    'tests/br-06/chon-connect-c01.spec.mjs',
    "    expect(Math.abs(mobileBadgeBox.width - 16)).toBeLessThanOrEqual(1);",
    "    expect(Math.abs(mobileBadgeBox.width - 16)).toBeLessThanOrEqual(1);\n    expect(mobileBadgeBox.height).toBeGreaterThan(mobileBadgeBox.width);\n    await expect(mobileCreator.getByTestId('chon-membership-badge-diamond-asset-16')).toBeVisible();",
)
replace_once(
    'tests/br-06/chon-connect-c01.spec.mjs',
    "    expect(Math.abs(desktopBadgeBox.width - 26)).toBeLessThanOrEqual(1);",
    "    expect(Math.abs(desktopBadgeBox.width - 26)).toBeLessThanOrEqual(1);\n    expect(desktopBadgeBox.height).toBeGreaterThan(desktopBadgeBox.width);\n    await expect(desktopCreator.getByTestId('chon-membership-badge-diamond-asset-26')).toBeVisible();",
)

replace_once(
    'tests/br-06/chon-membership-mem01.spec.mjs',
    "async function expectBadgeWidth(page, tier, expectedWidth) {\n  const badge = page.getByTestId(`chon-membership-badge-${tier}`);\n  await expect(badge).toBeVisible();\n  const box = await badge.boundingBox();\n  expect(box).not.toBeNull();\n  expect(Math.round(box.width)).toBe(expectedWidth);\n}",
    "async function expectBadge(page, tier, expectedWidth, expectedRendition) {\n  const badge = page.getByTestId(`chon-membership-badge-${tier}`);\n  await expect(badge).toBeVisible();\n  const box = await badge.boundingBox();\n  expect(box).not.toBeNull();\n  expect(Math.round(box.width)).toBe(expectedWidth);\n  expect(box.height).toBeGreaterThan(box.width);\n  await expect(page.getByTestId(`chon-membership-badge-${tier}-asset-${expectedRendition}`)).toBeVisible();\n}",
)
replace_once(
    'tests/br-06/chon-membership-mem01.spec.mjs',
    "    await expectBadgeWidth(page, 'premium', 132);\n    await expectBadgeWidth(page, 'diamond', 132);",
    "    await expectBadge(page, 'premium', 128, 160);\n    await expectBadge(page, 'diamond', 128, 160);",
)
replace_once(
    'tests/br-06/chon-membership-mem01.spec.mjs',
    "    await expectBadgeWidth(page, 'premium', 160);\n    await expectBadgeWidth(page, 'diamond', 160);",
    "    await expectBadge(page, 'premium', 160, 160);\n    await expectBadge(page, 'diamond', 160, 160);\n\n    const premiumStage = page.getByTestId('membership-badge-stage-premium');\n    await premiumStage.hover();\n    await expect(premiumStage).not.toHaveCSS('box-shadow', 'none');",
)

# The platform-specific file bypassed the shared Chọn.Love owner on Web.
legacy_web = ROOT / 'apps/mobile/src/components/luxy-membership-badge-image.web.tsx'
if not legacy_web.exists():
    raise SystemExit('legacy Web badge renderer missing before UI-ASSET01 cleanup')
legacy_web.unlink()
