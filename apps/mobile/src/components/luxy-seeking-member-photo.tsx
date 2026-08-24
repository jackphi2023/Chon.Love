import type { LuxyMembershipTier } from '@myfan/supabase';
import { ChonMemberPhoto } from './chon-member-photo';

// Compatibility wrapper for existing Seeking-derived row layouts.
// Photo loading, fallback, membership badge and photo count now live in ChonMemberPhoto.
export function LuxySeekingMemberPhoto({
  mediaId,
  storageBucket,
  storagePath,
  name,
  photoCount,
  membershipTier,
  width = 84,
  height = 112,
}: {
  mediaId: string | null;
  storageBucket: string | null;
  storagePath: string | null;
  name: string;
  photoCount?: number | null;
  membershipTier?: LuxyMembershipTier | null;
  width?: number;
  height?: number;
}) {
  const desktop = width >= 84;
  return (
    <ChonMemberPhoto
      badgeInset={5}
      desktop={desktop}
      fallbackFontSize={34}
      mediaId={mediaId}
      membershipTier={membershipTier}
      name={name}
      photoCount={photoCount}
      photoCountPlacement="bottom-right"
      storageBucket={storageBucket}
      storagePath={storagePath}
      style={{ borderRadius: 7, flexShrink: 0, height, width }}
      testID="chon-seeking-member-photo"
    />
  );
}
