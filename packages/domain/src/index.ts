export const HEART_UNITS_PER_HEART = 100;
export const VND_PER_HEART = 50_000;
export const BASIS_POINTS_DENOMINATOR = 10_000;
export const CREATOR_SHARE_BPS = 7_000;
export const PLATFORM_SHARE_BPS = 3_000;

export function heartsToUnits(hearts: number): number {
  assertNonNegativeSafeInteger(hearts, 'Hearts');
  return hearts * HEART_UNITS_PER_HEART;
}

export function heartUnitsToVnd(units: number): number {
  assertNonNegativeSafeInteger(units, 'Heart units');
  const amount = (units * VND_PER_HEART) / HEART_UNITS_PER_HEART;
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError('Converted VND amount must be a safe integer.');
  }
  return amount;
}

export function heartsToVnd(hearts: number): number {
  return heartUnitsToVnd(heartsToUnits(hearts));
}

export function splitGiftUnits(grossUnits: number): {
  creatorRewardUnits: number;
  platformGrossUnits: number;
} {
  assertNonNegativeSafeInteger(grossUnits, 'Gross units');
  const creatorRewardUnits = Math.floor(
    (grossUnits * CREATOR_SHARE_BPS) / BASIS_POINTS_DENOMINATOR,
  );
  return {
    creatorRewardUnits,
    platformGrossUnits: grossUnits - creatorRewardUnits,
  };
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer.`);
  }
}
