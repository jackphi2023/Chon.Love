import type { LuxyMembershipTier } from '@myfan/supabase';
import { Image, StyleSheet, View } from 'react-native';

// React Native/Metro requires static require() for bundled raster assets.
// These are the only canonical Chon.Love membership artworks: user-supplied images,
// downscaled without restyling to 480×320 PNGs and rendered at their exact 3:2 ratio.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PREMIUM_BADGE = require('../../assets/luxy/chonlove-premium.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DIAMOND_BADGE = require('../../assets/luxy/chonlove-diamond.png');

const BADGE_ASPECT_WIDTH = 3;
const BADGE_ASPECT_HEIGHT = 2;

export function LuxyMembershipBadgeImage({
  tier,
  width = 58,
  inset = 2,
}: {
  tier: LuxyMembershipTier | null | undefined;
  width?: number;
  inset?: number;
}) {
  if (tier !== 'premium' && tier !== 'diamond') return null;
  const height = Math.round((width * BADGE_ASPECT_HEIGHT) / BADGE_ASPECT_WIDTH);
  const label = tier === 'diamond' ? 'Thành viên Kim cương' : 'Thành viên Cao cấp';

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="image"
      pointerEvents="none"
      style={[styles.badge, { height, left: inset, top: inset, width }]}
      testID={`luxy-membership-badge-${tier}`}
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
  badge: {
    position: 'absolute',
    zIndex: 6,
  },
  image: {
    height: '100%',
    width: '100%',
  },
});
