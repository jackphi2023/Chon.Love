import type { CSSProperties } from 'react';
import { StyleSheet, type ImageStyle, type StyleProp } from 'react-native';
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

function imageStyle(size: number, style?: StyleProp<ImageStyle>): CSSProperties {
  return {
    display: 'block',
    height: size,
    objectFit: 'contain',
    width: size,
    ...(StyleSheet.flatten(style) as CSSProperties | undefined),
  };
}

export function ChonBrandIcon({ name, size = 18, style }: BrandIconProps) {
  return <img alt="" aria-hidden="true" src={CHON_BRAND_ICON_URIS[name]} style={imageStyle(size, style)} />;
}

export function ChonUserAvatar({ size = 36, style }: UserAvatarProps) {
  return <img alt="" aria-hidden="true" src={CHON_USER_AVATAR_URI} style={imageStyle(size, style)} />;
}
