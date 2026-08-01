export const colors = {
  background: '#F7FAFC',
  surface: '#FFFFFF',
  primary: '#D81B60',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  danger: '#B91C1C',
  focus: '#1D4ED8',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const accessibility = {
  minimumTouchTarget: 44,
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
