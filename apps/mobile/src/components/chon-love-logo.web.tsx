import type { CSSProperties } from 'react';
import { Image as ReactNativeImage, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

// Metro returns the environment-correct bundled URL; a static root path is not reliable in Expo web/Netlify.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoUri = ReactNativeImage.resolveAssetSource(require('../../public/chonlove-logo.webp')).uri;

export function ChonLoveLogo({
  width = 150,
  height = 50,
  style,
}: {
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const flattened = StyleSheet.flatten(style) as CSSProperties | undefined;

  return (
    <img
      alt="Chọn.love"
      decoding="async"
      draggable={false}
      height={height}
      loading="eager"
      src={logoUri}
      style={{
        display: 'block',
        height,
        objectFit: 'contain',
        userSelect: 'none',
        width,
        ...flattened,
      }}
      width={width}
    />
  );
}
