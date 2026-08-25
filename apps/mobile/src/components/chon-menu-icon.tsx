import { StyleSheet, View } from 'react-native';

type ChonMenuIconName = 'profile' | 'gift' | 'balance' | 'settings' | 'logout';

type ChonMenuIconProps = {
  name: ChonMenuIconName;
  size?: number;
  color?: string;
};

export function ChonMenuIcon({ name, size = 12, color = '#111111' }: ChonMenuIconProps) {
  const stroke = Math.max(1, size / 12);
  const common = { borderColor: color, borderWidth: stroke } as const;

  if (name === 'profile') {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.root, { height: size, width: size }]}>
        <View style={[styles.profileHead, common, { borderRadius: size, height: size * 0.34, left: size * 0.33, width: size * 0.34 }]} />
        <View style={[styles.profileBody, common, { borderRadius: size * 0.22, bottom: 0, height: size * 0.38, left: size * 0.17, width: size * 0.66 }]} />
      </View>
    );
  }

  if (name === 'gift') {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.root, { height: size, width: size }]}>
        <View style={[styles.giftLid, common, { height: size * 0.22, left: size * 0.08, top: size * 0.28, width: size * 0.84 }]} />
        <View style={[styles.giftBox, common, { bottom: 0, height: size * 0.52, left: size * 0.14, width: size * 0.72 }]} />
        <View style={[styles.giftRibbon, { backgroundColor: color, height: size * 0.72, left: size * 0.46, top: size * 0.28, width: stroke }]} />
        <View style={[styles.giftBow, common, { height: size * 0.25, left: size * 0.27, top: 0, transform: [{ rotate: '32deg' }], width: size * 0.26 }]} />
        <View style={[styles.giftBow, common, { height: size * 0.25, right: size * 0.27, top: 0, transform: [{ rotate: '-32deg' }], width: size * 0.26 }]} />
      </View>
    );
  }

  if (name === 'balance') {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.root, { height: size, width: size }]}>
        <View style={[styles.wallet, common, { borderRadius: size * 0.12, height: size * 0.68, left: size * 0.04, top: size * 0.16, width: size * 0.92 }]} />
        <View style={[styles.walletDot, { backgroundColor: color, borderRadius: size, height: size * 0.14, right: size * 0.18, top: size * 0.43, width: size * 0.14 }]} />
      </View>
    );
  }

  if (name === 'settings') {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.root, { height: size, width: size }]}>
        <View style={[styles.settingsRing, common, { borderRadius: size, height: size * 0.58, left: size * 0.21, top: size * 0.21, width: size * 0.58 }]} />
        <View style={[styles.settingsHub, common, { borderRadius: size, height: size * 0.2, left: size * 0.4, top: size * 0.4, width: size * 0.2 }]} />
        <View style={[styles.spokeVertical, { backgroundColor: color, height: size * 0.2, left: size * 0.46, top: 0, width: stroke }]} />
        <View style={[styles.spokeVertical, { backgroundColor: color, bottom: 0, height: size * 0.2, left: size * 0.46, width: stroke }]} />
        <View style={[styles.spokeHorizontal, { backgroundColor: color, height: stroke, left: 0, top: size * 0.48, width: size * 0.2 }]} />
        <View style={[styles.spokeHorizontal, { backgroundColor: color, height: stroke, right: 0, top: size * 0.48, width: size * 0.2 }]} />
      </View>
    );
  }

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.root, { height: size, width: size }]}>
      <View style={[styles.logoutDoor, common, { height: size * 0.82, left: 0, top: size * 0.09, width: size * 0.48 }]} />
      <View style={[styles.logoutLine, { backgroundColor: color, height: stroke, left: size * 0.33, top: size * 0.49, width: size * 0.58 }]} />
      <View style={[styles.logoutArrow, { borderColor: color, borderRightWidth: stroke, borderTopWidth: stroke, height: size * 0.3, right: size * 0.02, top: size * 0.34, transform: [{ rotate: '45deg' }], width: size * 0.3 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative' },
  profileHead: { position: 'absolute' },
  profileBody: { position: 'absolute' },
  giftLid: { position: 'absolute' },
  giftBox: { position: 'absolute' },
  giftRibbon: { position: 'absolute' },
  giftBow: { borderRadius: 999, position: 'absolute' },
  wallet: { position: 'absolute' },
  walletDot: { position: 'absolute' },
  settingsRing: { position: 'absolute' },
  settingsHub: { position: 'absolute' },
  spokeVertical: { position: 'absolute' },
  spokeHorizontal: { position: 'absolute' },
  logoutDoor: { position: 'absolute' },
  logoutLine: { position: 'absolute' },
  logoutArrow: { position: 'absolute' },
});
