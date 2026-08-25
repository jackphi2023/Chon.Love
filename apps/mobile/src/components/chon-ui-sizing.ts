// Canonical Chọn.Love web presentation sizes. Do not override these per screen.
// Keep artwork size separate from touch targets so accessibility targets remain >=44px.
export const CHON_ICON_SIZE_DESKTOP = 26;
export const CHON_ICON_SIZE_MOBILE = 18;
export const CHON_LOGO_HEIGHT_DESKTOP = 26;
export const CHON_LOGO_HEIGHT_MOBILE = 22;

// Membership badge has two intentionally separate presentation modes:
// - icon: compact status signal with canonical artwork HEIGHT (16px mobile / 26px desktop)
// - certificate: large branded artwork on profile/membership surfaces.
// UI-ASSET01 maps each mode to its own approved Chọn.Love source asset centrally.
export const CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_MOBILE = 16;
export const CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_DESKTOP = 26;
export const CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE = 132;
export const CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP = 160;

// Backward-compatible names for code outside the Chọn.Love badge resolver. New code
// must use the HEIGHT constants above because 16/26 describes rendered icon height.
export const CHON_MEMBERSHIP_BADGE_ICON_WIDTH_MOBILE = CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_MOBILE;
export const CHON_MEMBERSHIP_BADGE_ICON_WIDTH_DESKTOP = CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_DESKTOP;
export const CHON_MEMBERSHIP_BADGE_WIDTH_MOBILE = CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE;
export const CHON_MEMBERSHIP_BADGE_WIDTH_DESKTOP = CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP;
