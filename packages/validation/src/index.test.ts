import { describe, expect, it } from 'vitest';
import {
  adultDateOfBirthSchema,
  datingInterestSchema,
  emailSchema,
  heightCmSchema,
  isAtLeastAge,
  luxyProfileEditorSchema,
  luxyProfileSetupSchema,
  minimumOnboardingSchema,
  normalizeInterests,
  profileEditorSchema,
  profileImageMetadataSchema,
  relationshipStatusSchema,
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

  it('locks the Seeking-derived Luxy interest and relationship vocabularies', () => {
    expect(datingInterestSchema.options).toEqual(['female', 'male', 'everyone']);
    expect(relationshipStatusSchema.options).toEqual([
      'single',
      'divorced',
      'widowed',
      'open',
      'complicated',
      'prefer_not_to_say',
    ]);
  });

  it('validates Luxy height in centimeters at the database boundary range', () => {
    expect(heightCmSchema.safeParse(120).success).toBe(true);
    expect(heightCmSchema.safeParse(178).success).toBe(true);
    expect(heightCmSchema.safeParse(230).success).toBe(true);
    expect(heightCmSchema.safeParse(119).success).toBe(false);
    expect(heightCmSchema.safeParse(231).success).toBe(false);
    expect(heightCmSchema.safeParse(178.5).success).toBe(false);
  });

  it('validates a complete Luxy profile editor payload while allowing legacy null height', () => {
    const base = {
      username: 'luxy_member',
      displayName: 'Luxy Member',
      bio: 'Tìm một mối quan hệ có chất lượng.',
      gender: 'male' as const,
      provinceId: 1,
      interests: ['Du lịch'],
      discoveryEnabled: true,
      nearbyEnabled: true,
      interestedIn: 'female' as const,
      relationshipStatus: 'single' as const,
    };
    expect(luxyProfileEditorSchema.safeParse({ ...base, heightCm: 178 }).success).toBe(true);
    expect(luxyProfileEditorSchema.safeParse({ ...base, heightCm: null }).success).toBe(true);
  });

  it('requires the Seeking-derived core fields for Luxy profile setup', () => {
    const setup = {
      gender: 'female' as const,
      interestedIn: 'male' as const,
      heightCm: 165,
      relationshipStatus: 'single' as const,
      provinceId: 1,
    };
    expect(luxyProfileSetupSchema.safeParse(setup).success).toBe(true);
    expect(luxyProfileSetupSchema.safeParse({ ...setup, heightCm: null }).success).toBe(false);
    expect(luxyProfileSetupSchema.safeParse({ ...setup, provinceId: null }).success).toBe(false);
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
