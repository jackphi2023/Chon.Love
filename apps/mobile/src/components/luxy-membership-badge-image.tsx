import type { LuxyMembershipTier } from '@myfan/supabase';
import { Image, StyleSheet, View } from 'react-native';

const PREMIUM_BADGE = require('../../assets/luxy/premium-badge.png');
const DIAMOND_BADGE = require('../../assets/luxy/diamond-badge.png');

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
  const height = Math.round((width * 2) / 3);
  const label = tier === 'diamond' ? 'Thành viên Kim cương' : 'Thành viên Cao cấp';

  return (
    <View
      accessibilityLabel={label}
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
