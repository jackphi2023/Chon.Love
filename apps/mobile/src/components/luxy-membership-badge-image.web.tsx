import type { LuxyMembershipTier } from '@myfan/supabase';
import type { CSSProperties } from 'react';

export function LuxyMembershipBadgeImage({
  tier,
  width = 58,
  inset = 2,
}: {
  tier: LuxyMembershipTier | null | undefined;
  width?: number;
  inset?: number;
}) {
  if (tier !== 'premium' && tier !== 'diamond') return null;

  const diamond = tier === 'diamond';
  const label = diamond ? 'Thành viên Kim cương' : 'Thành viên Cao cấp';
  const height = Math.max(22, Math.round(width * 0.31));
  const style = {
    height,
    left: inset,
    pointerEvents: 'none',
    position: 'absolute',
    top: inset,
    width,
    zIndex: 6,
  } satisfies CSSProperties;

  return (
    <div aria-label={label} role="img" style={style} data-testid={`luxy-membership-badge-${tier}`}>
      <svg
        aria-hidden="true"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 180 56"
        width="100%"
      >
        <rect
          fill={diamond ? '#081726' : '#C81C1D'}
          height="52"
          rx="26"
          stroke="#F2B51D"
          strokeWidth="2"
          width="176"
          x="2"
          y="2"
        />
        {diamond ? (
          <g transform="translate(13 14)">
            <path d="M6 0h20l6 8-16 20L0 8 6 0Z" fill="#F2B51D" />
            <path d="m6 0 10 28L26 0M0 8h32" fill="none" stroke="#FFF8DC" strokeWidth="1.4" />
          </g>
        ) : (
          <g transform="translate(13 13)">
            <path d="m1 20 3-14 8 7 6-12 6 12 8-7 3 14H1Z" fill="#F2B51D" />
            <rect fill="#FFF8DC" height="4" rx="2" width="34" x="1" y="23" />
          </g>
        )}
        <text
          fill="#FFFFFF"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="18"
          fontWeight="700"
          letterSpacing="0.6"
          x="58"
          y="35"
        >
          {diamond ? 'DIAMOND' : 'PREMIUM'}
        </text>
      </svg>
    </div>
  );
}
