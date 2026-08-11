import { describe, expect, it } from 'vitest';
import {
  adultDateOfBirthSchema,
  childrenStatusSchema,
  datingInterestSchema,
  drinkingStatusSchema,
  educationLevelSchema,
  emailSchema,
  heightCmSchema,
  isAtLeastAge,
  luxyProfileEditorSchema,
  luxyProfileSetupSchema,
  minimumOnboardingSchema,
  normalizeInterests,
  profileEditorSchema,
  profileImageMetadataSchema,
  profileLifestyleTagSchema,
  relationshipStatusSchema,
  smokingStatusSchema,
  usernameSchema,
  weightKgSchema,
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

  it('locks the Seeking-derived Luxy enum vocabularies', () => {
    expect(datingInterestSchema.options).toEqual(['female', 'male', 'everyone']);
    expect(relationshipStatusSchema.options).toEqual([
      'single',
      'divorced',
      'widowed',
      'open',
      'complicated',
      'prefer_not_to_say',
    ]);
    expect(childrenStatusSchema.options).toEqual([
      'no_children',
      'has_children',
      'prefer_not_to_say',
    ]);
    expect(smokingStatusSchema.options).toEqual([
      'never',
      'socially',
      'regularly',
      'trying_to_quit',
      'prefer_not_to_say',
    ]);
    expect(drinkingStatusSchema.options).toEqual([
      'never',
      'socially',
      'regularly',
      'prefer_not_to_say',
    ]);
    expect(educationLevelSchema.options).toContain('masters');
    expect(profileLifestyleTagSchema.options).toContain('marriage_minded');
    expect(profileLifestyleTagSchema.options).toContain('travel_companion');
    expect(profileLifestyleTagSchema.options).toContain('fine_dining');
  });

  it('validates Luxy physical fields at database boundary ranges', () => {
    expect(heightCmSchema.safeParse(120).success).toBe(true);
    expect(heightCmSchema.safeParse(178).success).toBe(true);
    expect(heightCmSchema.safeParse(230).success).toBe(true);
    expect(heightCmSchema.safeParse(119).success).toBe(false);
    expect(heightCmSchema.safeParse(231).success).toBe(false);
    expect(heightCmSchema.safeParse(178.5).success).toBe(false);

    expect(weightKgSchema.safeParse(35).success).toBe(true);
    expect(weightKgSchema.safeParse(70).success).toBe(true);
    expect(weightKgSchema.safeParse(250).success).toBe(true);
    expect(weightKgSchema.safeParse(34).success).toBe(false);
    expect(weightKgSchema.safeParse(251).success).toBe(false);
  });

  it('validates the full LX-07 profile editor contract while keeping optional physical data nullable', () => {
    const base = {
      username: 'luxy_member',
      displayName: 'Luxy Member',
      bio: 'Tìm một mối quan hệ có chất lượng.',
      gender: 'male' as const,
      provinceId: 1,
      interests: ['Du lịch'],
      discoveryEnabled: true,
      nearbyEnabled: true,
      headline: 'Doanh nhân yêu du lịch và trải nghiệm mới',
      interestedIn: 'female' as const,
      relationshipStatus: 'single' as const,
      childrenStatus: 'no_children' as const,
      smokingStatus: 'never' as const,
      drinkingStatus: 'socially' as const,
      educationLevel: 'masters' as const,
      occupation: 'Doanh nhân',
      lookingFor: 'Một mối quan hệ nghiêm túc, tôn trọng và cùng phát triển.',
      agePreferenceMin: 25,
      agePreferenceMax: 40,
      lifestyleTags: ['long_term', 'marriage_minded', 'ready_to_travel'] as const,
      languages: ['Tiếng Việt', 'English'],
    };

    const result = luxyProfileEditorSchema.safeParse({ ...base, heightCm: 178, weightKg: 72 });
    expect(result.success).toBe(true);

    const legacyCompatible = luxyProfileEditorSchema.safeParse({
      ...base,
      heightCm: null,
      weightKg: null,
    });
    expect(legacyCompatible.success).toBe(true);
  });

  it('normalizes Luxy tags/languages and rejects inverted age preference', () => {
    const base = {
      username: 'luxy_member',
      displayName: 'Luxy Member',
      bio: '',
      gender: 'female' as const,
      provinceId: 1,
      interests: [],
      discoveryEnabled: true,
      nearbyEnabled: false,
      headline: '',
      interestedIn: 'male' as const,
      heightCm: 165,
      weightKg: null,
      relationshipStatus: 'single' as const,
      childrenStatus: 'prefer_not_to_say' as const,
      smokingStatus: 'prefer_not_to_say' as const,
      drinkingStatus: 'prefer_not_to_say' as const,
      educationLevel: 'prefer_not_to_say' as const,
      occupation: '',
      lookingFor: '',
      lifestyleTags: ['romantic', 'romantic', 'fine_dining'] as const,
      languages: [' Tiếng Việt ', 'tiếng việt', 'English'],
    };

    const parsed = luxyProfileEditorSchema.parse({
      ...base,
      agePreferenceMin: 25,
      agePreferenceMax: 40,
    });
    expect(parsed.lifestyleTags).toEqual(['romantic', 'fine_dining']);
    expect(parsed.languages).toEqual(['Tiếng Việt', 'English']);

    expect(
      luxyProfileEditorSchema.safeParse({
        ...base,
        agePreferenceMin: 45,
        agePreferenceMax: 30,
      }).success,
    ).toBe(false);
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
