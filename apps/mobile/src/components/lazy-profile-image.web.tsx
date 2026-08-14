import type { CSSProperties } from 'react';
import { Image, StyleSheet, type ImageProps } from 'react-native';

type NetworkImageSource = { uri?: string | null };

function getNetworkUri(source: ImageProps['source']): string | null {
  if (!source || typeof source === 'number' || Array.isArray(source)) return null;
  const uri = (source as NetworkImageSource).uri;
  return typeof uri === 'string' && uri.length > 0 ? uri : null;
}

/**
 * Browser implementation for user photos.
 *
 * `loading="lazy"` prevents below-the-fold profile photos from downloading until the
 * browser needs them and `decoding="async"` keeps large JPEG decode work off the
 * critical rendering path. Static/native image sources fall back to React Native Image.
 */
export function LazyProfileImage({
  accessibilityLabel,
  resizeMode = 'cover',
  source,
  style,
  ...rest
}: ImageProps) {
  const uri = getNetworkUri(source);
  if (!uri) return <Image accessibilityLabel={accessibilityLabel} resizeMode={resizeMode} source={source} style={style} {...rest} />;

  const flattened = StyleSheet.flatten(style) ?? {};
  const cssStyle = {
    ...(flattened as unknown as CSSProperties),
    display: 'block',
    objectFit: resizeMode === 'stretch' ? 'fill' : resizeMode,
  } satisfies CSSProperties;

  return (
    <img
      alt={accessibilityLabel ?? ''}
      decoding="async"
      loading="lazy"
      src={uri}
      style={cssStyle}
    />
  );
}
