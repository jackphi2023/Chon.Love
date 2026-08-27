import { Image, StyleSheet, View } from 'react-native';
import {
  isChonMembershipBadgeTier,
  resolveChonMembershipBadgeAsset,
  type ChonMembershipBadgeContext,
  type ChonMembershipBadgeVariant,
} from './chon-membership-badge-assets';

export { getChonMembershipBadgeWidth } from './chon-membership-badge-assets';
export type { ChonMembershipBadgeContext, ChonMembershipBadgeVariant } from './chon-membership-badge-assets';

export function ChonMembershipBadge({
  tier,
  desktop,
  variant = 'icon',
  context,
  inset = 2,
  width,
  placement = 'top-left',
  size,
}: {
  // Public profile RPCs intentionally expose this field as a string. Keep the
  // runtime boundary defensive and render only the two paid tiers we support.
  tier: string | null | undefined;
  desktop: boolean;
  variant?: ChonMembershipBadgeVariant;
  context?: ChonMembershipBadgeContext | undefined;
  inset?: number;
  width?: number;
  placement?: 'top-left' | 'top-right';
  size?: 'small' | 'medium' | 'large' | undefined;
}) {
  if (!isChonMembershipBadgeTier(tier)) return null;

  // `size` remains only as a compatibility bridge for callers not yet migrated.
  // New Chọn.Love surfaces use semantic contexts so Connect/Profile/Mini geometry
  // cannot silently drift apart. Every resolved box is derived from the selected
  // tier asset's intrinsic dimensions, never from a square slot or the other tier.
  const compatibilityContext: ChonMembershipBadgeContext | undefined = size === 'small'
    ? 'mini'
    : size === 'large'
      ? 'certificate'
      : undefined;
  const resolvedContext = context ?? compatibilityContext;
  const resolvedVariant = resolvedContext === 'certificate' ? 'certificate' : variant;
  const resolvedDesktop = size === 'medium' ? true : size === 'small' ? false : desktop;
  const resolved = resolveChonMembershipBadgeAsset({
    desktop: resolvedDesktop,
    tier,
    variant: resolvedVariant,
    context: resolvedContext,
    width,
  });
  const label = tier === 'diamond' ? 'Thành viên Kim cương' : 'Thành viên Cao cấp';

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="image"
      pointerEvents="none"
      style={[
        styles.badge,
        { height: resolved.height, top: inset, width: resolved.width },
        placement === 'top-right' ? { right: inset } : { left: inset },
      ]}
      testID={`chon-membership-badge-${tier}`}
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={resolved.source}
        style={[styles.image, { aspectRatio: resolved.aspectRatio }]}
        testID={`chon-membership-badge-image-${tier}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', zIndex: 6 },
  image: { height: '100%', width: '100%' },
});
