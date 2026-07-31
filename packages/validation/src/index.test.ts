import { describe, expect, it } from 'vitest';
import {
  adultDateOfBirthSchema,
  emailSchema,
  isAtLeastAge,
  minimumOnboardingSchema,
  normalizeInterests,
  profileEditorSchema,
  profileImageMetadataSchema,
  usernameSchema,
} from './index';

describe('shared validation', () => {
  it('normalizes email addresses', () => {
    expect(emailSchema.parse(' Adult@Example.COM ')).toBe('adult@example.com');
  });

  it('rejects unsafe usernames', () => {
    expect(usernameSchema.safeParse('bad name').success).toBe(false);
  });

  it('checks the 18th birthday boundary', () => {
    const now = new Date('2026-07-29T00:00:00.000Z');
    expect(isAtLeastAge('2008-07-29', 18, now)).toBe(true);
    expect(isAtLeastAge('2008-07-30', 18, now)).toBe(false);
    expect(adultDateOfBirthSchema.safeParse('2010-01-01').success).toBe(false);
  });

  it('requires every minimum onboarding acceptance', () => {
    const valid = {
      dateOfBirth: '1990-01-01',
      confirmedAdult: true,
      acceptedTerms: true,
      acceptedCommunityStandards: true,
    };
    expect(minimumOnboardingSchema.safeParse(valid).success).toBe(true);
    expect(minimumOnboardingSchema.safeParse({ ...valid, acceptedTerms: false }).success).toBe(false);
    expect(
      minimumOnboardingSchema.safeParse({ ...valid, acceptedCommunityStandards: false }).success,
    ).toBe(false);
  });

  it('normalizes interests without duplicate labels', () => {
    expect(normalizeInterests([' Âm nhạc ', 'âm nhạc', 'Du lịch', ''])).toEqual([
      'Âm nhạc',
      'Du lịch',
    ]);
  });

  it('validates a complete profile editor payload', () => {
    const result = profileEditorSchema.parse({
      username: 'creator_01',
      displayName: 'Creator MyFan',
      bio: 'Chia sẻ âm nhạc và những khoảnh khắc tích cực.',
      gender: 'prefer_not_to_say',
      provinceId: 1,
      interests: ['Âm nhạc', 'Du lịch'],
      discoveryEnabled: true,
      nearbyEnabled: false,
    });
    expect(result.interests).toEqual(['Âm nhạc', 'Du lịch']);
  });

  it('requires exactly one selected province for a completed member profile', () => {
    const base = {
      username: 'creator_01',
      displayName: 'Creator MyFan',
      bio: '',
      gender: 'prefer_not_to_say' as const,
      interests: [],
      discoveryEnabled: true,
      nearbyEnabled: false,
    };
    expect(profileEditorSchema.safeParse({ ...base, provinceId: 1 }).success).toBe(true);
    expect(profileEditorSchema.safeParse({ ...base, provinceId: null }).success).toBe(false);
    expect(profileEditorSchema.safeParse({ ...base, provinceId: 0 }).success).toBe(false);
  });

  it('rejects oversized or mismatched image metadata', () => {
    expect(
      profileImageMetadataSchema.safeParse({
        mimeType: 'image/jpeg',
        fileSizeBytes: 1024,
        width: 1080,
        height: 1080,
        extension: 'png',
      }).success,
    ).toBe(false);
    expect(
      profileImageMetadataSchema.safeParse({
        mimeType: 'image/jpeg',
        fileSizeBytes: 11 * 1024 * 1024,
        width: 1080,
        height: 1080,
        extension: 'jpg',
      }).success,
    ).toBe(false);
  });
});