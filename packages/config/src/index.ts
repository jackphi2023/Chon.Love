export const PRODUCT_NAME = 'MyFan';
export const MINIMUM_USER_AGE = 18;

export const ENVIRONMENT_NAMES = ['development', 'staging', 'production'] as const;
export type EnvironmentName = (typeof ENVIRONMENT_NAMES)[number];

export function isEnvironmentName(value: string | undefined): value is EnvironmentName {
  return ENVIRONMENT_NAMES.includes(value as EnvironmentName);
}

export const featureFlags = {
  strangerMessaging: false,
  bulkMessaging: false,
  exactLocationPins: false,
  videoAndLivestream: false,
  automaticWithdrawals: false,
  unreviewedFanContent: false,
} as const;

export const phaseCFeatureFlags = {
  google_play_billing: false,
  send_gift: false,
  creator_wallet: false,
  creator_kyc: false,
  withdrawal: false,
  fan_album: true,
  creator_activity: true,
  creator_activity_links: true,
  creator_activity_gift_lock: true,
  creator_activity_public_web: true,
  push_notifications: false,
  native_deep_links: false,
} as const;

export type PhaseCFeatureFlagName = keyof typeof phaseCFeatureFlags;

export function resolvePhaseCFeatureFlag(
  name: PhaseCFeatureFlagName,
  value: string | undefined,
): boolean {
  if (value === undefined || value === '') return phaseCFeatureFlags[name];
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Feature flag ${name} must be true or false.`);
}
