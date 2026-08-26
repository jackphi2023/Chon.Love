import { Image, StyleSheet, View } from 'react-native';
import {
  isChonMembershipBadgeTier,
  resolveChonMembershipBadgeAsset,
  type ChonMembershipBadgeVariant,
} from './chon-membership-badge-assets';

export { getChonMembershipBadgeWidth } from './chon-membership-badge-assets';
export type { ChonMembershipBadgeVariant } from './chon-membership-badge-assets';

export function ChonMembershipBadge({
  tier,
  desktop,
  variant = 'icon',
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
  inset?: number;
  width?: number;
  placement?: 'top-left' | 'top-right';
  size?: 'small' | 'medium' | 'large';
}) {
  if (!isChonMembershipBadgeTier(tier)) return null;
  const resolvedVariant = size === 'large' ? 'certificate' : size ? 'icon' : variant;
  const resolvedDesktop = size ? size !== 'small' : desktop;
  const resolved = resolveChonMembershipBadgeAsset({ desktop: resolvedDesktop, tier, variant: resolvedVariant, width });
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
        style={styles.image}
        testID={`chon-membership-badge-image-${tier}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', zIndex: 6 },
  image: { height: '100%', width: '100%' },
});
