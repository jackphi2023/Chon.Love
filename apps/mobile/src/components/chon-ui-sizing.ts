// Canonical Chọn.Love web presentation sizes. Do not override these per screen.
// Keep artwork size separate from touch targets so accessibility targets remain >=44px.
export const CHON_ICON_SIZE_DESKTOP = 26;
export const CHON_ICON_SIZE_MOBILE = 18;
export const CHON_LOGO_HEIGHT_DESKTOP = 26;
export const CHON_LOGO_HEIGHT_MOBILE = 22;

// Membership badge has two intentionally separate presentation modes:
// - icon: compact status signal on member cards (16px mobile / 26px desktop)
// - certificate: large branded artwork on profile/membership surfaces.
// The underlying approved badge artwork remains unchanged until UI-ASSET01.
export const CHON_MEMBERSHIP_BADGE_ICON_WIDTH_MOBILE = 16;
export const CHON_MEMBERSHIP_BADGE_ICON_WIDTH_DESKTOP = 26;
export const CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE = 132;
export const CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP = 160;

// Backward-compatible aliases for screens not migrated yet.
export const CHON_MEMBERSHIP_BADGE_WIDTH_MOBILE = CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE;
export const CHON_MEMBERSHIP_BADGE_WIDTH_DESKTOP = CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP;
