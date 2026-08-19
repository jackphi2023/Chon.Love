import type { LuxyMembershipTier } from '@myfan/supabase';
import { Image, StyleSheet, View } from 'react-native';

// React Native/Metro requires static require() for bundled raster assets.
// These canonical Chon.Love certification assets are validated 768×528 transparent PNGs (16:11).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PREMIUM_BADGE = require('../../assets/luxy/premium-badge-hq.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DIAMOND_BADGE = require('../../assets/luxy/diamond-badge-hq.png');

const BADGE_ASPECT_WIDTH = 16;
const BADGE_ASPECT_HEIGHT = 11;

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
