import { Image, type ImageStyle, type StyleProp } from 'react-native';

// React Native/Metro requires static require() for bundled raster assets.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CHON_LOVE_LOGO = require('../../assets/luxy/chon-love-logo.png');
const LOGO_ASPECT_RATIO = 420 / 184;
const DEFAULT_LOGO_HEIGHT = 50;

type ChonLoveLogoProps = {
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
};

function resolveLogoSize(width?: number, height?: number) {
  if (width && height) {
    const requestedAspectRatio = width / height;
    if (requestedAspectRatio > LOGO_ASPECT_RATIO) {
      return { height, width: height * LOGO_ASPECT_RATIO };
    }
    return { height: width / LOGO_ASPECT_RATIO, width };
  }

  if (width) {
    return { height: width / LOGO_ASPECT_RATIO, width };
  }

  const resolvedHeight = height ?? DEFAULT_LOGO_HEIGHT;
  return { height: resolvedHeight, width: resolvedHeight * LOGO_ASPECT_RATIO };
}

export function ChonLoveLogo({ width, height, style }: ChonLoveLogoProps) {
  const resolvedSize = resolveLogoSize(width, height);

  return (
    <Image
      accessibilityIgnoresInvertColors
      accessibilityLabel="Chọn.Love"
      accessibilityRole="image"
      resizeMode="contain"
      source={CHON_LOVE_LOGO}
      style={[resolvedSize, style]}
    />
  );
}
