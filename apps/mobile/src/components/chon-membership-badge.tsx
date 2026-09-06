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
  // New Chọn.Love surfaces use semantic contexts. The accepted member Profile
  // presentation is intentionally large certificate artwork; Connect remains a
  // compact status signal. Do not let a semantic refactor shrink Profile back to
  // the mini icon geometry.
  const compatibilityContext: ChonMembershipBadgeContext | undefined = size === 'small'
    ? 'mini'
    : size === 'large'
      ? 'certificate'
      : undefined;
  const requestedContext = context ?? compatibilityContext;
  const resolvedContext: ChonMembershipBadgeContext | undefined = requestedContext === 'profile'
    ? 'certificate'
    : requestedContext;
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
  const certificate = resolvedVariant === 'certificate';

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="image"
      pointerEvents="none"
      style={[
        styles.badge,
        // Keep both axes explicit. React Native Web can otherwise let replaced
        // image content stretch an absolutely positioned wrapper even when the
        // semantic height is correct.
        { height: resolved.height, top: inset, width: resolved.width },
        certificate
          ? { left: '50%', transform: [{ translateX: -resolved.width / 2 }] }
          : placement === 'top-right'
            ? { right: inset }
            : { left: inset },
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