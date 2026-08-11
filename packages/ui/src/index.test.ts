import { describe, expect, it } from 'vitest';
import {
  accessibility,
  colors,
  contrastRatio,
  luxyBrand,
  luxyBreakpoints,
  luxyColors,
  luxyLayout,
  luxyRadii,
  luxySpacing,
  meetsWcagAa,
} from './index';

describe('Luxy.Love shared UI foundation', () => {
  it('keeps minimum touch targets at least 44 CSS points', () => {
    expect(accessibility.minimumTouchTarget).toBeGreaterThanOrEqual(44);
    expect(accessibility.preferredTouchTarget).toBeGreaterThanOrEqual(accessibility.minimumTouchTarget);
  });

  it('uses the Seeking-derived Luxy authenticated navigation hierarchy', () => {
    expect(luxyBrand.productName).toBe('Luxy.Love');
    expect(luxyBrand.primaryNavigation).toEqual(['Tìm kiếm', 'Yêu thích', 'Tin nhắn', 'Nâng cấp']);
  });

  it('uses the Seeking-derived ink and coral palette instead of the historical MyFan pink', () => {
    expect(luxyColors.ink).toBe('#081726');
    expect(luxyColors.brandCoral).toBe('#FF4A4A');
    expect(colors.primary).toBe(luxyColors.ink);
    expect(Object.values(luxyColors)).not.toContain('#D81B60');
  });

  it('locks the core responsive and Search layout measurements', () => {
    expect(luxyBreakpoints.mobile).toBe(768);
    expect(luxyBreakpoints.desktop).toBe(1024);
    expect(luxyLayout.searchSidebarWidth).toBeGreaterThanOrEqual(330);
    expect(luxyLayout.searchSidebarWidth).toBeLessThanOrEqual(370);
    expect(luxyLayout.memberCardAspectRatio).toBeCloseTo(0.75, 4);
    expect(luxyRadii.pill).toBe(999);
    expect(luxySpacing.huge).toBe(64);
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
