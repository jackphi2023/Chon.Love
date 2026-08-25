import type { LuxyMembershipTier } from '@myfan/supabase';
import { ChonMembershipBadge } from './chon-membership-badge';

// Compatibility bridge for screens not migrated yet. Chọn.Love owns the implementation.
// Larger legacy callers use the certificate source so compact 16/26 artwork is never upscaled.
export function LuxyMembershipBadgeImage({
  tier,
  width = 58,
  inset = 2,
}: {
  tier: LuxyMembershipTier | null | undefined;
  width?: number;
  inset?: number;
}) {
  return (
    <ChonMembershipBadge
      desktop={width >= 26}
      inset={inset}
      tier={tier}
      variant={width > 40 ? 'certificate' : 'icon'}
      width={width}
    />
  );
}
