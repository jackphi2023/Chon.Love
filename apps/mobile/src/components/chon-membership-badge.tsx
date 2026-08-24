import type { LuxyMembershipTier } from '@myfan/supabase';
import {
  CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP,
  CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE,
  CHON_MEMBERSHIP_BADGE_ICON_WIDTH_DESKTOP,
  CHON_MEMBERSHIP_BADGE_ICON_WIDTH_MOBILE,
} from './chon-ui-sizing';
import { LuxyMembershipBadgeImage } from './luxy-membership-badge-image';

export type ChonMembershipBadgeVariant = 'icon' | 'certificate';

export function getChonMembershipBadgeWidth(input: {
  desktop: boolean;
  variant: ChonMembershipBadgeVariant;
}): number {
  if (input.variant === 'icon') {
    return input.desktop
      ? CHON_MEMBERSHIP_BADGE_ICON_WIDTH_DESKTOP
      : CHON_MEMBERSHIP_BADGE_ICON_WIDTH_MOBILE;
  }
  return input.desktop
    ? CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP
    : CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE;
}

export function ChonMembershipBadge({
  tier,
  desktop,
  variant = 'icon',
  inset = 2,
}: {
  tier: LuxyMembershipTier | null | undefined;
  desktop: boolean;
  variant?: ChonMembershipBadgeVariant;
  inset?: number;
}) {
  return (
    <LuxyMembershipBadgeImage
      inset={inset}
      tier={tier}
      width={getChonMembershipBadgeWidth({ desktop, variant })}
    />
  );
}
