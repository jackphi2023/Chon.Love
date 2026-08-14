import { Image, type ImageStyle, type StyleProp } from 'react-native';

const chonLoveLogo = { uri: '/chonlove-logo.webp' } as const;

export function ChonLoveLogo({
  width = 150,
  height = 50,
  style,
}: {
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      accessibilityLabel="Chon.Love"
      resizeMode="contain"
      source={chonLoveLogo}
      style={[{ width, height }, style]}
    />
  );
}
