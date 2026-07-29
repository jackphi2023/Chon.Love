import { describe, expect, it } from 'vitest';
import {
  CREATOR_SHARE_BPS,
  HEART_UNITS_PER_HEART,
  PLATFORM_SHARE_BPS,
  heartsToUnits,
  splitGiftUnits,
} from './index';

describe('heart economy defaults', () => {
  it('keeps the 70/30 split invariant', () => {
    expect(CREATOR_SHARE_BPS + PLATFORM_SHARE_BPS).toBe(10_000);
  });

  it('converts whole hearts to integer units', () => {
    expect(heartsToUnits(10)).toBe(10 * HEART_UNITS_PER_HEART);
  });

  it('splits a one-heart gift exactly', () => {
    expect(splitGiftUnits(100)).toEqual({
      creatorRewardUnits: 70,
      platformGrossUnits: 30,
    });
  });
});
