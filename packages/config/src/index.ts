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
