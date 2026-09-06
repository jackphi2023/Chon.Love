import type { ImageSourcePropType } from 'react-native';
import {
  CHON_MEMBERSHIP_BADGE_CERTIFICATE_HEIGHT_DESKTOP,
  CHON_MEMBERSHIP_BADGE_CERTIFICATE_HEIGHT_MOBILE,
  CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_DESKTOP,
  CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_MOBILE,
} from './chon-ui-sizing';

export type ChonMembershipBadgeTier = 'premium' | 'diamond';
export type ChonMembershipBadgeVariant = 'icon' | 'certificate';
export type ChonMembershipBadgeContext = 'mini' | 'connect' | 'profile' | 'certificate';

export type ChonMembershipBadgeAsset = {
  key: string;
  source: ImageSourcePropType;
  intrinsicWidth: number;
  intrinsicHeight: number;
};

export type ResolvedChonMembershipBadgeAsset = ChonMembershipBadgeAsset & {
  width: number;
  height: number;
  aspectRatio: number;
};

// React Native/Metro requires literal static require() calls for bundled raster assets.
// UI code must use this resolver rather than importing badge files directly so every
// surface shares the same source artwork and intrinsic aspect-ratio contract.
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
    iconMobile: { key: 'premium-icon-mobile', source: PREMIUM_ICON_MOBILE, intrinsicWidth: 29, intrinsicHeight: 40 },
    iconDesktop: { key: 'premium-icon-desktop', source: PREMIUM_ICON_DESKTOP, intrinsicWidth: 33, intrinsicHeight: 46 },
    certificate: { key: 'premium-certificate', source: PREMIUM_CERTIFICATE, intrinsicWidth: 179, intrinsicHeight: 199 },
  },
  diamond: {
    iconMobile: { key: 'diamond-icon-mobile', source: DIAMOND_ICON_MOBILE, intrinsicWidth: 31, intrinsicHeight: 41 },
    iconDesktop: { key: 'diamond-icon-desktop', source: DIAMOND_ICON_DESKTOP, intrinsicWidth: 38, intrinsicHeight: 50 },
    certificate: { key: 'diamond-certificate', source: DIAMOND_CERTIFICATE, intrinsicWidth: 180, intrinsicHeight: 208 },
  },
};

const CONTEXT_HEIGHT: Record<'mini' | 'profile', number> = {
  mini: 12,
  // `profile` is retained only as a compatibility icon context. Canonical member
  // profile heroes use the explicit `certificate` context so a refactor cannot
  // silently shrink their accepted large artwork back to a mini status icon.
  profile: 20,
};

export function isChonMembershipBadgeTier(
  tier: string | null | undefined,
): tier is ChonMembershipBadgeTier {
  return tier === 'premium' || tier === 'diamond';
}

function resolveAsset(input: {
  tier: ChonMembershipBadgeTier;
  desktop: boolean;
  variant: ChonMembershipBadgeVariant;
  context?: ChonMembershipBadgeContext | undefined;
}): ChonMembershipBadgeAsset {
  const tierAssets = BADGE_ASSETS[input.tier];
  if (input.context === 'certificate' || input.variant === 'certificate') return tierAssets.certificate;
  if (input.context === 'mini') return tierAssets.iconMobile;
  // Connect is an accepted ~26px status surface on both responsive layouts. Use
  // the dedicated 26px source rather than scaling the 16px raster up on mobile.
  if (input.context === 'connect') return tierAssets.iconDesktop;
  if (input.context === 'profile') return tierAssets.iconDesktop;
  return input.desktop ? tierAssets.iconDesktop : tierAssets.iconMobile;
}

function dimensionsFromHeight(asset: ChonMembershipBadgeAsset, height: number): ResolvedChonMembershipBadgeAsset {
  const aspectRatio = asset.intrinsicWidth / asset.intrinsicHeight;
  return { ...asset, height, width: height * aspectRatio, aspectRatio };
}

function dimensionsFromWidth(asset: ChonMembershipBadgeAsset, width: number): ResolvedChonMembershipBadgeAsset {
  const aspectRatio = asset.intrinsicWidth / asset.intrinsicHeight;
  return { ...asset, width, height: width / aspectRatio, aspectRatio };
}

export function getChonMembershipBadgeWidth(input: {
  tier?: ChonMembershipBadgeTier | undefined;
  desktop: boolean;
  variant: ChonMembershipBadgeVariant;
  context?: ChonMembershipBadgeContext | undefined;
}): number {
  const tier = input.tier ?? 'premium';
  return resolveChonMembershipBadgeAsset({ ...input, tier }).width;
}

export function resolveChonMembershipBadgeAsset(input: {
  tier: ChonMembershipBadgeTier;
  desktop: boolean;
  variant: ChonMembershipBadgeVariant;
  context?: ChonMembershipBadgeContext | undefined;
  width?: number | undefined;
}): ResolvedChonMembershipBadgeAsset {
  const asset = resolveAsset(input);

  if (typeof input.width === 'number') return dimensionsFromWidth(asset, input.width);

  if (input.context === 'connect') {
    return dimensionsFromHeight(asset, CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_DESKTOP);
  }

  if (input.context === 'mini' || input.context === 'profile') {
    return dimensionsFromHeight(asset, CONTEXT_HEIGHT[input.context]);
  }

  if (input.context === 'certificate' || input.variant === 'certificate') {
    const height = input.desktop
      ? CHON_MEMBERSHIP_BADGE_CERTIFICATE_HEIGHT_DESKTOP
      : CHON_MEMBERSHIP_BADGE_CERTIFICATE_HEIGHT_MOBILE;
    return dimensionsFromHeight(asset, height);
  }

  const height = input.desktop
    ? CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_DESKTOP
    : CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_MOBILE;
  return dimensionsFromHeight(asset, height);
}
