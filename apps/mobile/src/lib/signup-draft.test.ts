import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSignupDraft,
  isCompleteEmailOtp,
  normalizeEmailOtp,
  patchSignupDraft,
  readSignupDraft,
  writeSignupDraft,
} from './signup-draft';

describe('signup onboarding draft', () => {
  beforeEach(() => clearSignupDraft());

  it('normalizes email OTP input to six digits', () => {
    expect(normalizeEmailOtp(' 12a3-4567 ')).toBe('123456');
    expect(isCompleteEmailOtp('123456')).toBe(true);
    expect(isCompleteEmailOtp('12345')).toBe(false);
    expect(isCompleteEmailOtp('12345a')).toBe(false);
  });

  it('preserves step-one preferences while auth advances', () => {
    writeSignupDraft({
      gender: 'female',
      interest: 'male',
      email: null,
      stage: 'account',
      updatedAt: 1_000,
    });

    expect(patchSignupDraft({ email: 'member@example.com', stage: 'otp', updatedAt: 2_000 })).toEqual({
      gender: 'female',
      interest: 'male',
      email: 'member@example.com',
      stage: 'otp',
      updatedAt: 2_000,
    });
    expect(readSignupDraft(2_001)?.interest).toBe('male');
  });

  it('drops stale signup state rather than reviving an old registration', () => {
    writeSignupDraft({
      gender: 'male',
      interest: 'everyone',
      email: 'old@example.com',
      stage: 'otp',
      updatedAt: 1,
    });

    expect(readSignupDraft(24 * 60 * 60 * 1_000 + 2)).toBeNull();
  });
});
