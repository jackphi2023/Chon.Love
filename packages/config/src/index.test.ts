import { describe, expect, it } from 'vitest';
import {
  ENVIRONMENT_NAMES,
  isEnvironmentName,
  phaseCFeatureFlags,
  resolvePhaseCFeatureFlag,
} from './index';

describe('environment configuration', () => {
  it('contains exactly three supported environments', () => {
    expect(ENVIRONMENT_NAMES).toEqual(['development', 'staging', 'production']);
  });

  it('rejects unknown environment labels', () => {
    expect(isEnvironmentName('development')).toBe(true);
    expect(isEnvironmentName('preview')).toBe(false);
    expect(isEnvironmentName(undefined)).toBe(false);
  });

  it('keeps Phase C financial execution disabled by default', () => {
    expect(phaseCFeatureFlags.google_play_billing).toBe(false);
    expect(phaseCFeatureFlags.send_gift).toBe(false);
    expect(phaseCFeatureFlags.creator_wallet).toBe(false);
    expect(phaseCFeatureFlags.creator_kyc).toBe(false);
    expect(phaseCFeatureFlags.withdrawal).toBe(false);
    expect(resolvePhaseCFeatureFlag('send_gift', undefined)).toBe(false);
  });
});
