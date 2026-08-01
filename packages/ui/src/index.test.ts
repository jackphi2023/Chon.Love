import { describe, expect, it } from 'vitest';
import { accessibility, colors, contrastRatio, meetsWcagAa } from './index';

describe('shared accessibility tokens', () => {
  it('keeps minimum touch targets at least 44 CSS points', () => {
    expect(accessibility.minimumTouchTarget).toBeGreaterThanOrEqual(44);
    expect(accessibility.preferredTouchTarget).toBeGreaterThanOrEqual(accessibility.minimumTouchTarget);
  });

  it.each([
    [colors.text, colors.surface],
    [colors.muted, colors.surface],
    [colors.surface, colors.primary],
    [colors.surface, colors.danger],
  ])('meets WCAG AA contrast for %s on %s', (foreground, background) => {
    expect(meetsWcagAa(foreground, background)).toBe(true);
  });

  it('calculates the black-on-white ratio', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 4);
  });
});
