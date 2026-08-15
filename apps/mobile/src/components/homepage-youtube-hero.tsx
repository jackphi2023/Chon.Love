import type { ImageSourcePropType } from 'react-native';
import { ImageBackground, View, type StyleProp, type ViewStyle } from 'react-native';

export function HomepageYoutubeHero({
  fallbackSource,
  style,
}: {
  desktopUrl?: string | null;
  mobileUrl?: string | null;
  isPhone?: boolean;
  fallbackSource: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <ImageBackground source={fallbackSource} resizeMode="cover" style={{ height: '100%', width: '100%' }} />
    </View>
  );
}
