// Canonical Chọn.Love web presentation sizes. Do not override these per screen.
// Keep artwork size separate from touch targets so accessibility targets remain >=44px.
export const CHON_ICON_SIZE_DESKTOP = 26;
export const CHON_ICON_SIZE_MOBILE = 18;
export const CHON_LOGO_HEIGHT_DESKTOP = 26;
export const CHON_LOGO_HEIGHT_MOBILE = 22;

// Membership badge presentation modes:
// - icon: compact status signal; geometry is resolved from source aspect ratio.
// - certificate: larger membership artwork rendered inside the historical 132x91
//   mobile / 160x110 desktop stage. Height is the limiting dimension because the
//   approved Premium/Diamond source artwork is portrait, not landscape.
export const CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_MOBILE = 16;
export const CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_DESKTOP = 26;
export const CHON_MEMBERSHIP_BADGE_CERTIFICATE_HEIGHT_MOBILE = 91;
export const CHON_MEMBERSHIP_BADGE_CERTIFICATE_HEIGHT_DESKTOP = 110;
export const CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE = 132;
export const CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP = 160;

// Backward-compatible names for code outside the Chọn.Love badge resolver. New code
// must use semantic badge contexts rather than treating these values as square slots.
export const CHON_MEMBERSHIP_BADGE_ICON_WIDTH_MOBILE = CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_MOBILE;
export const CHON_MEMBERSHIP_BADGE_ICON_WIDTH_DESKTOP = CHON_MEMBERSHIP_BADGE_ICON_HEIGHT_DESKTOP;
export const CHON_MEMBERSHIP_BADGE_WIDTH_MOBILE = CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_MOBILE;
export const CHON_MEMBERSHIP_BADGE_WIDTH_DESKTOP = CHON_MEMBERSHIP_BADGE_CERTIFICATE_WIDTH_DESKTOP;
