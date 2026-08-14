import { Image, type ImageProps } from 'react-native';

/**
 * Native/default implementation. Native image views already defer decoding until mounted;
 * the web override adds browser-native lazy loading and async decoding.
 */
export function LazyProfileImage(props: ImageProps) {
  return <Image {...props} />;
}
