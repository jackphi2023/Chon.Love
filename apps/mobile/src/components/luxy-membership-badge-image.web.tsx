import type { LuxyMembershipTier } from '@myfan/supabase';
import { Image, StyleSheet, View } from 'react-native';

// Canonical 768x512 artwork supplied for Chon.Love membership certification.
// Static requires let Expo/Metro fingerprint and bundle the exact approved assets.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PREMIUM_BADGE = require('../../assets/luxy/premium-badge-hq.webp');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DIAMOND_BADGE = require('../../assets/luxy/diamond-badge-hq.webp');

export function LuxyMembershipBadgeImage({
  tier,
  width = 112,
  inset = 10,
}: {
  tier: LuxyMembershipTier;
  width?: number;
  inset?: number;
}) {
  if (tier !== 'premium' && tier !== 'diamond') return null;

  const height = Math.round((width * 2) / 3);
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
  badge: { position: 'absolute', zIndex: 6 },
  image: { height: '100%', width: '100%' },
});
