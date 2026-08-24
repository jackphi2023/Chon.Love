import type { LuxyMembershipTier } from '@myfan/supabase';
import { ChonMembershipBadge } from './chon-membership-badge';

// Compatibility bridge for screens not migrated yet. Chọn.Love owns the implementation.
export function LuxyMembershipBadgeImage({
  tier,
  width = 58,
  inset = 2,
}: {
  tier: LuxyMembershipTier | null | undefined;
  width?: number;
  inset?: number;
}) {
  return <ChonMembershipBadge desktop={width >= 26} inset={inset} tier={tier} variant="icon" width={width} />;
}