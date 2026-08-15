import type { CSSProperties } from 'react';
import { StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

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
      src="/chonlove-logo.webp"
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
