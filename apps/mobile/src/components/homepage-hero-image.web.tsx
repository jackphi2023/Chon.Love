import type { CSSProperties } from 'react';
import { StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

export function HomepageHeroImage({
  accessibilityLabel,
  uri,
  style,
}: {
  accessibilityLabel: string;
  uri: string;
  style?: StyleProp<ImageStyle>;
}) {
  const flattened = StyleSheet.flatten(style) ?? {};
  const cssStyle = {
    ...(flattened as unknown as CSSProperties),
    display: 'block',
    objectFit: 'cover',
  } satisfies CSSProperties;

  return (
    <img
      alt={accessibilityLabel}
      decoding="async"
      fetchPriority="high"
      loading="eager"
      src={uri}
      style={cssStyle}
      data-testid="chon-homepage-hero-slide-image"
    />
  );
}
