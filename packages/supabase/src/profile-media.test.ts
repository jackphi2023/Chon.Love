import { describe, expect, it, vi } from 'vitest';
import {
  createPrivateMediaUrl,
  createPublicProfileMediaUrl,
  isMediaHiddenByModeration,
  isMediaVisibleToOwner,
  PRIVATE_PROFILE_MEDIA_URL_TTL_SECONDS,
  PUBLIC_PROFILE_MEDIA_URL_TTL_SECONDS,
  updateMyLuxyProfile,
} from './profile-media';

describe('profile photo delivery', () => {
  it('reuses public/avatar signed URLs for an hour so browser and CDN caches can warm', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.test/photo' }, error: null });
    const from = vi.fn().mockReturnValue({ createSignedUrl });
    const client = { storage: { from } } as unknown as Parameters<typeof createPublicProfileMediaUrl>[0];

    await expect(createPublicProfileMediaUrl(client, {
      storage_bucket: 'profile-media',
      storage_path: 'profiles/user/avatar.jpg',
    })).resolves.toBe('https://example.test/photo');

    expect(PUBLIC_PROFILE_MEDIA_URL_TTL_SECONDS).toBe(60 * 60);
    expect(from).toHaveBeenCalledWith('profile-media');
    expect(createSignedUrl).toHaveBeenCalledWith('profiles/user/avatar.jpg', 60 * 60);
  });

  it('keeps private media URLs short-lived by default', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.test/private' }, error: null });
    const client = {
      storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) },
    } as unknown as Parameters<typeof createPrivateMediaUrl>[0];

    await createPrivateMediaUrl(client, {
      storage_bucket: 'profile-media',
      storage_path: 'profiles/user/private.jpg',
    });

    expect(PRIVATE_PROFILE_MEDIA_URL_TTL_SECONDS).toBe(5 * 60);
    expect(createSignedUrl).toHaveBeenCalledWith('profiles/user/private.jpg', 5 * 60);
  });
});

describe('post-moderated profile media', () => {
  it('shows newly finalized media without a public review label', () => {
    expect(isMediaVisibleToOwner({ moderation_status: 'pending_review', deleted_at: null })).toBe(true);
  });

  it('keeps approved media visible', () => {
    expect(isMediaVisibleToOwner({ moderation_status: 'approved', deleted_at: null })).toBe(true);
  });

  it('hides rejected, quarantined and deleted media', () => {
    expect(isMediaHiddenByModeration({ moderation_status: 'rejected', deleted_at: null })).toBe(true);
    expect(isMediaHiddenByModeration({ moderation_status: 'quarantined', deleted_at: null })).toBe(true);
    expect(isMediaHiddenByModeration({ moderation_status: 'deleted', deleted_at: '2026-07-30T00:00:00Z' })).toBe(true);
  });
});

describe('LX-07 Luxy profile RPC client', () => {
  it('maps the complete typed Luxy editor payload to update_my_luxy_profile', async () => {
    const profile = { id: 'profile-1' };
    const rpc = vi.fn().mockResolvedValue({ data: profile, error: null });
    const client = { rpc } as unknown as Parameters<typeof updateMyLuxyProfile>[0];

    await expect(
      updateMyLuxyProfile(client, {
        username: 'luxy_member',
        displayName: 'Luxy Member',
        bio: 'Tìm một mối quan hệ có chất lượng.',
        gender: 'male',
        provinceId: 79,
        interests: ['Du lịch'],
        discoveryEnabled: true,
        nearbyEnabled: true,
        headline: 'Doanh nhân yêu du lịch',
        interestedIn: 'female',
        heightCm: 178,
        weightKg: 72,
        relationshipStatus: 'single',
        childrenStatus: 'no_children',
        smokingStatus: 'never',
        drinkingStatus: 'socially',
        educationLevel: 'masters',
        occupation: 'Doanh nhân',
        lookingFor: 'Mối quan hệ nghiêm túc.',
        agePreferenceMin: 25,
        agePreferenceMax: 40,
        lifestyleTags: ['long_term', 'marriage_minded', 'ready_to_travel'],
        languages: ['Tiếng Việt', 'English'],
      }),
    ).resolves.toEqual(profile);

    expect(rpc).toHaveBeenCalledWith('update_my_luxy_profile', {
      p_username: 'luxy_member',
      p_display_name: 'Luxy Member',
      p_bio: 'Tìm một mối quan hệ có chất lượng.',
      p_gender: 'male',
      p_province_id: 79,
      p_interests: ['Du lịch'],
      p_discovery_enabled: true,
      p_nearby_enabled: true,
      p_headline: 'Doanh nhân yêu du lịch',
      p_interested_in: 'female',
      p_height_cm: 178,
      p_weight_kg: 72,
      p_relationship_status: 'single',
      p_children_status: 'no_children',
      p_smoking_status: 'never',
      p_drinking_status: 'socially',
      p_education_level: 'masters',
      p_occupation: 'Doanh nhân',
      p_looking_for: 'Mối quan hệ nghiêm túc.',
      p_age_preference_min: 25,
      p_age_preference_max: 40,
      p_lifestyle_tags: ['long_term', 'marriage_minded', 'ready_to_travel'],
      p_languages: ['Tiếng Việt', 'English'],
    });
  });

  it('omits nullable/blank RPC args so SQL defaults clear optional profile fields', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'profile-1' }, error: null });
    const client = { rpc } as unknown as Parameters<typeof updateMyLuxyProfile>[0];

    await updateMyLuxyProfile(client, {
      username: 'luxy_member',
      displayName: 'Luxy Member',
      bio: '',
      gender: 'prefer_not_to_say',
      provinceId: 79,
      interests: [],
      discoveryEnabled: true,
      nearbyEnabled: false,
      headline: '',
      interestedIn: 'everyone',
      heightCm: null,
      weightKg: null,
      relationshipStatus: 'prefer_not_to_say',
      childrenStatus: 'prefer_not_to_say',
      smokingStatus: 'prefer_not_to_say',
      drinkingStatus: 'prefer_not_to_say',
      educationLevel: 'prefer_not_to_say',
      occupation: '',
      lookingFor: '',
      agePreferenceMin: 18,
      agePreferenceMax: 99,
      lifestyleTags: [],
      languages: [],
    });

    const args = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args).not.toHaveProperty('p_bio');
    expect(args).not.toHaveProperty('p_headline');
    expect(args).not.toHaveProperty('p_height_cm');
    expect(args).not.toHaveProperty('p_weight_kg');
    expect(args).not.toHaveProperty('p_occupation');
    expect(args).not.toHaveProperty('p_looking_for');
    expect(args).toMatchObject({
      p_interested_in: 'everyone',
      p_relationship_status: 'prefer_not_to_say',
      p_age_preference_min: 18,
      p_age_preference_max: 99,
      p_lifestyle_tags: [],
      p_languages: [],
    });
  });
});
