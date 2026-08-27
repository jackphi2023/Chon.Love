import { Image, type ImageStyle, type StyleProp } from 'react-native';

export function HomepageHeroImage({
  accessibilityLabel,
  uri,
  style,
}: {
  accessibilityLabel: string;
  uri: string;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      fadeDuration={0}
      resizeMode="cover"
      source={{ uri, cache: 'force-cache' }}
      style={style}
      testID="chon-homepage-hero-slide-image"
    />
  );
}
