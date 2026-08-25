import type { ImageSourcePropType } from 'react-native';
import {
  CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP,
  CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE,
  CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_DESKTOP,
  CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_MOBILE,
} from './chon-ui-sizing';

export type ChonMembershipBadgeTier = 'premium' | 'diamond';
export type ChonMembershipBadgeVariant = 'icon' | 'certificate';

export type ChonMembershipBadgeAsset = {
  key: string;
  source: ImageSourcePropType;
  intrinsicWidth: number;
  intrinsicHeight: number;
};

export type ResolvedChonMembershipBadgeAsset = ChonMembershipBadgeAsset & {
  width: number;
  height: number;
};

// React Native/Metro requires literal static require() calls for bundled raster assets.
// UI code must use this resolver rather than importing badge files directly so a future
// Admin asset registry can replace the source for each semantic context in one place.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PREMIUM_ICON_MOBILE = require('../../assets/chon/membership-badges/premium-16.png') as ImageSourcePropType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PREMIUM_ICON_DESKTOP = require('../../assets/chon/membership-badges/premium-26.png') as ImageSourcePropType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PREMIUM_CERTIFICATE = require('../../assets/chon/membership-badges/premium-160.png') as ImageSourcePropType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DIAMOND_ICON_MOBILE = require('../../assets/chon/membership-badges/diamond-16.png') as ImageSourcePropType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DIAMOND_ICON_DESKTOP = require('../../assets/chon/membership-badges/diamond-26.png') as ImageSourcePropType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DIAMOND_CERTIFICATE = require('../../assets/chon/membership-badges/diamond-160.png') as ImageSourcePropType;

const BADGE_ASSETS: Record<
  ChonMembershipBadgeTier,
  {
    iconMobile: ChonMembershipBadgeAsset;
    iconDesktop: ChonMembershipBadgeAsset;
    certificate: ChonMembershipBadgeAsset;
  }
> = {
  premium: {
    iconMobile: {
      key: 'premium-icon-mobile',
      source: PREMIUM_ICON_MOBILE,
      intrinsicWidth: 29,
      intrinsicHeight: 40,
    },
    iconDesktop: {
      key: 'premium-icon-desktop',
      source: PREMIUM_ICON_DESKTOP,
      intrinsicWidth: 33,
      intrinsicHeight: 46,
    },
    certificate: {
      key: 'premium-certificate',
      source: PREMIUM_CERTIFICATE,
      intrinsicWidth: 179,
      intrinsicHeight: 199,
    },
  },
  diamond: {
    iconMobile: {
      key: 'diamond-icon-mobile',
      source: DIAMOND_ICON_MOBILE,
      intrinsicWidth: 31,
      intrinsicHeight: 41,
    },
    iconDesktop: {
      key: 'diamond-icon-desktop',
      source: DIAMOND_ICON_DESKTOP,
      intrinsicWidth: 38,
      intrinsicHeight: 50,
    },
    certificate: {
      key: 'diamond-certificate',
      source: DIAMOND_CERTIFICATE,
      intrinsicWidth: 180,
      intrinsicHeight: 208,
    },
  },
};

// Membership already has a stable visual slot. Keep that slot geometry while the
// 160-class portrait artwork uses resizeMode="contain" inside it, so the artwork is
// never stretched or cropped and the surrounding MEM01 layout does not regress.
const CERTIFICATE_SLOT_HEIGHT_MOBILE = 91;
const CERTIFICATE_SLOT_HEIGHT_DESKTOP = 110;

export function isChonMembershipBadgeTier(
  tier: string | null | undefined,
): tier is ChonMembershipBadgeTier {
  return tier === 'premium' || tier === 'diamond';
}

export function getChonMembershipBadgeWidth(input: {
  desktop: boolean;
  variant: ChonMembershipBadgeVariant;
}): number {
  if (input.variant === 'certificate') {
    return input.desktop
      ? CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP
      : CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE;
  }

  const asset = input.desktop ? BADGE_ASSETS.premium.iconDesktop : BADGE_ASSETS.premium.iconMobile;
  const height = input.desktop
    ? CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_DESKTOP
    : CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_MOBILE;
  return Math.round((height * asset.intrinsicWidth) / asset.intrinsicHeight);
}

export function resolveChonMembershipBadgeAsset(input: {
  tier: ChonMembershipBadgeTier;
  desktop: boolean;
  variant: ChonMembershipBadgeVariant;
  width?: number | undefined;
}): ResolvedChonMembershipBadgeAsset {
  const tierAssets = BADGE_ASSETS[input.tier];
  const asset =
    input.variant === 'certificate'
      ? tierAssets.certificate
      : input.desktop
        ? tierAssets.iconDesktop
        : tierAssets.iconMobile;

  if (input.variant === 'certificate') {
    const canonicalWidth = input.desktop
      ? CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP
      : CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE;
    const canonicalHeight = input.desktop
      ? CERTIFICATE_SLOT_HEIGHT_DESKTOP
      : CERTIFICATE_SLOT_HEIGHT_MOBILE;
    const width = input.width ?? canonicalWidth;
    return {
      ...asset,
      width,
      height: Math.round((width * canonicalHeight) / canonicalWidth),
    };
  }

  if (typeof input.width === 'number') {
    return {
      ...asset,
      width: input.width,
      height: Math.round((input.width * asset.intrinsicHeight) / asset.intrinsicWidth),
    };
  }

  const height = input.desktop
    ? CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_DESKTOP
    : CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_MOBILE;
  return {
    ...asset,
    height,
    width: Math.round((height * asset.intrinsicWidth) / asset.intrinsicHeight),
  };
}
