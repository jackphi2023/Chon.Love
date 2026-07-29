export const HEART_UNITS_PER_HEART = 100;
export const VND_PER_HEART = 10_000;
export const BASIS_POINTS_DENOMINATOR = 10_000;
export const CREATOR_SHARE_BPS = 7_000;
export const PLATFORM_SHARE_BPS = 3_000;

export function heartsToUnits(hearts: number): number {
  if (!Number.isSafeInteger(hearts) || hearts < 0) {
    throw new RangeError('Hearts must be a non-negative safe integer.');
  }
  return hearts * HEART_UNITS_PER_HEART;
}

export function splitGiftUnits(grossUnits: number): {
  creatorRewardUnits: number;
  platformGrossUnits: number;
} {
  if (!Number.isSafeInteger(grossUnits) || grossUnits < 0) {
    throw new RangeError('Gross units must be a non-negative safe integer.');
  }
  const creatorRewardUnits = Math.floor(
    (grossUnits * CREATOR_SHARE_BPS) / BASIS_POINTS_DENOMINATOR,
  );
  return {
    creatorRewardUnits,
    platformGrossUnits: grossUnits - creatorRewardUnits,
  };
}
