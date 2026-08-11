export const luxyColors = {
  /** Seeking reference: dark promotional strip, primary dark CTA and private-photo surfaces. */
  ink: '#081726',
  /** Seeking reference brand coral. Use for identity/accent details, not normal white-on-red body text. */
  brandCoral: '#FF4A4A',
  /** Darker reference red used for accessible action surfaces with white text. */
  actionRed: '#C81C1D',
  danger: '#CF0404',
  surface: '#FFFFFF',
  background: '#FFFFFF',
  subtleSurface: '#F8F8F8',
  elevatedSubtle: '#F3F2F1',
  text: '#081726',
  muted: '#545454',
  softMuted: '#7E7E7E',
  border: '#D9D9D9',
  borderStrong: '#C4C4C4',
  online: '#4FAF61',
  focus: '#337AB7',
  selectedAccentSurface: '#FBE5E5',
  overlay: 'rgba(8, 23, 38, 0.62)',
  photoGradientStart: 'rgba(8, 23, 38, 0)',
  photoGradientEnd: 'rgba(8, 23, 38, 0.88)',
} as const;

export const luxySpacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

export const luxyRadii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const luxyTypography = {
  families: {
    /** License-safe system fallback; page implementations may load an approved editorial serif later. */
    display: 'Georgia',
    body: 'System',
    brand: 'Georgia',
  },
  sizes: {
    caption: 12,
    small: 13,
    body: 15,
    navigation: 16,
    section: 20,
    title: 28,
    display: 44,
  },
  lineHeights: {
    caption: 16,
    small: 18,
    body: 22,
    navigation: 20,
    section: 26,
    title: 34,
    display: 50,
  },
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const luxyBreakpoints = {
  compactPhone: 430,
  mobile: 768,
  desktop: 1024,
  wideDesktop: 1280,
} as const;

export type LuxyShellMode = 'compact' | 'desktop';

/** LX-03 contract: the full Seeking-style authenticated desktop shell starts at 1024 px. */
export function resolveLuxyShellMode(width: number): LuxyShellMode {
  return width >= luxyBreakpoints.desktop ? 'desktop' : 'compact';
}

export const luxyLayout = {
  authenticatedPromoHeight: 46,
  authenticatedNavHeight: 60,
  contentMaxWidth: 1440,
  contentHorizontalPaddingMobile: 16,
  contentHorizontalPaddingDesktop: 24,
  searchSidebarWidth: 356,
  searchGap: 24,
  memberCardAspectRatio: 3 / 4,
  profilePhotoAspectRatio: 3 / 4,
  formControlHeight: 48,
  primaryActionHeight: 48,
  minimumTouchTarget: 44,
} as const;

export const luxyShadows = {
  navigation: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
} as const;

export const luxyBrand = {
  productName: 'Luxy.Love',
  shortName: 'Luxy',
  /** Authenticated shell order mirrors the user-provided Seeking reference. */
  primaryNavigation: ['Tìm kiếm', 'Yêu thích', 'Tin nhắn', 'Nâng cấp'] as const,
} as const;

/**
 * Backward-compatible aliases used by existing MyFan screens while LX-00→LX-21
 * migrates presentation incrementally. New Luxy UI should prefer the luxy* tokens.
 */
export const colors = {
  background: luxyColors.background,
  surface: luxyColors.surface,
  primary: luxyColors.ink,
  accent: luxyColors.actionRed,
  brand: luxyColors.brandCoral,
  text: luxyColors.text,
  muted: luxyColors.muted,
  border: luxyColors.border,
  danger: luxyColors.danger,
  focus: luxyColors.focus,
  online: luxyColors.online,
} as const;

export const spacing = {
  xs: luxySpacing.xs,
  sm: luxySpacing.sm,
  md: luxySpacing.lg,
  lg: luxySpacing.xl,
  xl: luxySpacing.xxl,
} as const;

export const accessibility = {
  minimumTouchTarget: luxyLayout.minimumTouchTarget,
  preferredTouchTarget: 48,
  focusRingWidth: 3,
  focusRingOffset: 3,
  minimumBodyContrast: 4.5,
  minimumLargeTextContrast: 3,
} as const;

export const motion = {
  instant: 0,
  fast: 120,
  normal: 200,
  slow: 320,
} as const;

type Rgb = Readonly<{ r: number; g: number; b: number }>;

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(parseHexColor(foreground)), relativeLuminance(parseHexColor(background)));
  const darker = Math.min(relativeLuminance(parseHexColor(foreground)), relativeLuminance(parseHexColor(background)));
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWcagAa(
  foreground: string,
  background: string,
  options: { largeText?: boolean } = {},
): boolean {
  return contrastRatio(foreground, background) >= (
    options.largeText ? accessibility.minimumLargeTextContrast : accessibility.minimumBodyContrast
  );
}

function parseHexColor(value: string): Rgb {
  const normalized = value.trim().replace(/^#/, '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((character) => `${character}${character}`).join('')
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) throw new Error(`Unsupported color value: ${value}`);
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function relativeLuminance(color: Rgb): number {
  const channels = [color.r, color.g, color.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}
