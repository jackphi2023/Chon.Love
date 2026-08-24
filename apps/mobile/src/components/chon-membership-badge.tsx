import type { LuxyMembershipTier } from '@myfan/supabase';
import { Image, StyleSheet, View } from 'react-native';
import {
  CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP,
  CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE,
  CHON_MEMBERSHIP_BADGE_ICON_WIDTH_DESKTOP,
  CHON_MEMBERSHIP_BADGE_ICON_WIDTH_MOBILE,
} from './chon-ui-sizing';

// React Native/Metro requires static require() for bundled raster assets.
// These are the currently approved Chọn.Love badge assets; UI-ASSET01 owns any future asset swap.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PREMIUM_BADGE = require('../../assets/luxy/premium-badge-hq.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DIAMOND_BADGE = require('../../assets/luxy/diamond-badge-hq.png');

const BADGE_ASPECT_WIDTH = 16;
const BADGE_ASPECT_HEIGHT = 11;

export type ChonMembershipBadgeVariant = 'icon' | 'certificate';

export function getChonMembershipBadgeWidth(input: {
  desktop: boolean;
  variant: ChonMembershipBadgeVariant;
}): number {
  if (input.variant === 'icon') {
    return input.desktop
      ? CHON_MEMBERSHIP_BADGE_ICON_WIDTH_DESKTOP
      : CHON_MEMBERSHIP_BADGE_ICON_WIDTH_MOBILE;
  }
  return input.desktop
    ? CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP
    : CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE;
}

export function ChonMembershipBadge({
  tier,
  desktop,
  variant = 'icon',
  inset = 2,
  width,
}: {
  tier: LuxyMembershipTier | null | undefined;
  desktop: boolean;
  variant?: ChonMembershipBadgeVariant;
  inset?: number;
  width?: number;
}) {
  if (tier !== 'premium' && tier !== 'diamond') return null;
  const resolvedWidth = width ?? getChonMembershipBadgeWidth({ desktop, variant });
  const height = Math.round((resolvedWidth * BADGE_ASPECT_HEIGHT) / BADGE_ASPECT_WIDTH);
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
        source={tier === 'diamond' ? DIAMOND_BADGE : PREMIUM_BADGE}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', zIndex: 6 },
  image: { height: '100%', width: '100%' },
});