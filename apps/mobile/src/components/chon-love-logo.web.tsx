import { Image, type ImageStyle, type StyleProp, useWindowDimensions } from 'react-native';
import { CHON_LOGO_HEIGHT_DESKTOP, CHON_LOGO_HEIGHT_MOBILE } from '@/components/chon-ui-sizing';

// Keep the browser on the same approved bundled logo asset as native.
// React Native Web resolves Metro's static asset module without relying on
// Image.resolveAssetSource, which is not part of the current web runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CHON_LOVE_LOGO = require('../../assets/luxy/chon-love-logo.png');
const LOGO_ASPECT_RATIO = 420 / 184;
const DESKTOP_BREAKPOINT = 768;

type ChonLoveLogoProps = {
  width?: number;
  height?: number;
  scale?: number;
  testID?: string;
  style?: StyleProp<ImageStyle>;
};

export function ChonLoveLogo({ scale = 1, style, testID = 'chon-love-wordmark' }: ChonLoveLogoProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const baseHeight = viewportWidth < DESKTOP_BREAKPOINT
    ? CHON_LOGO_HEIGHT_MOBILE
    : CHON_LOGO_HEIGHT_DESKTOP;
  const resolvedHeight = baseHeight * scale;
  const resolvedWidth = resolvedHeight * LOGO_ASPECT_RATIO;

  return (
    <Image
      accessibilityIgnoresInvertColors
      accessibilityLabel="Chọn.Love"
      accessibilityRole="image"
      resizeMode="contain"
      source={CHON_LOVE_LOGO}
      style={[style, { height: resolvedHeight, width: resolvedWidth }]}
      testID={testID}
    />
  );
}