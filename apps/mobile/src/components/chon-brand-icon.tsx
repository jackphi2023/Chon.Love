import { Image, type ImageStyle, type StyleProp } from 'react-native';
import {
  CHON_BRAND_ICON_URIS,
  CHON_USER_AVATAR_URI,
  type ChonBrandIconName,
} from '@/components/chon-brand-icon-assets';

export type { ChonBrandIconName } from '@/components/chon-brand-icon-assets';

type BrandIconProps = {
  name: ChonBrandIconName;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

type UserAvatarProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function ChonBrandIcon({ name, size = 18, style }: BrandIconProps) {
  return (
    <Image
      accessibilityElementsHidden
      accessible={false}
      resizeMode="contain"
      source={{ uri: CHON_BRAND_ICON_URIS[name] }}
      style={[{ height: size, width: size }, style]}
    />
  );
}

export function ChonUserAvatar({ size = 36, style }: UserAvatarProps) {
  return (
    <Image
      accessibilityElementsHidden
      accessible={false}
      resizeMode="contain"
      source={{ uri: CHON_USER_AVATAR_URI }}
      style={[{ height: size, width: size }, style]}
    />
  );
}
