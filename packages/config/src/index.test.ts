import { describe, expect, it } from 'vitest';
import { ENVIRONMENT_NAMES, isEnvironmentName } from './index';

describe('environment configuration', () => {
  it('contains exactly three supported environments', () => {
    expect(ENVIRONMENT_NAMES).toEqual(['development', 'staging', 'production']);
  });

  it('rejects unknown environment labels', () => {
    expect(isEnvironmentName('development')).toBe(true);
    expect(isEnvironmentName('preview')).toBe(false);
    expect(isEnvironmentName(undefined)).toBe(false);
  });
});
