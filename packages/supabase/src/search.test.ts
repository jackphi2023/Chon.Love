import { describe, expect, it, vi } from 'vitest';
import {
  formatLuxyDistance,
  getNextLuxySearchOffset,
  parseLuxySearchInput,
  searchLuxyProfilesV2,
} from './search';

describe('Luxy Search V2 client contract', () => {
  it('defaults to the distance-first Search contract', () => {
    expect(parseLuxySearchInput({})).toMatchObject({
      sort: 'distance',
      minAge: 18,
      maxAge: 99,
      limit: 24,
      offset: 0,
    });
  });

  it('rejects inverted age, height and weight ranges before RPC execution', () => {
    expect(() => parseLuxySearchInput({ minAge: 40, maxAge: 20 })).toThrow('invalid_search_age_range');
    expect(() => parseLuxySearchInput({ minHeightCm: 190, maxHeightCm: 160 })).toThrow('invalid_search_height_range');
    expect(() => parseLuxySearchInput({ minWeightKg: 90, maxWeightKg: 50 })).toThrow('invalid_search_weight_range');
  });

  it('maps Seeking-derived filters to the V2 RPC without inventing verification/favorite state', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const client = { rpc } as never;

    await searchLuxyProfilesV2(client, {
      sort: 'recent',
      provinceId: 79,
      maxDistanceKm: 50,
      minAge: 25,
      maxAge: 40,
      genders: ['female'],
      minHeightCm: 155,
      maxHeightCm: 180,
      relationshipStatuses: ['single'],
      lifestyleTags: ['long_term', 'ready_to_travel'],
      languages: ['Tiếng Việt'],
      interests: ['Du lịch'],
      hasPhoto: true,
      onlineNow: true,
      occupationText: 'kiến trúc',
      profileText: 'nghiêm túc',
      limit: 20,
      offset: 40,
    });

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0]?.[0]).toBe('search_luxy_profiles_v2');
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      p_sort: 'recent',
      p_province_id: 79,
      p_max_distance_km: 50,
      p_min_age: 25,
      p_max_age: 40,
      p_genders: ['female'],
      p_min_height_cm: 155,
      p_max_height_cm: 180,
      p_relationship_statuses: ['single'],
      p_lifestyle_tags: ['long_term', 'ready_to_travel'],
      p_languages: ['Tiếng Việt'],
      p_interests: ['Du lịch'],
      p_has_photo: true,
      p_online_now: true,
      p_occupation_text: 'kiến trúc',
      p_profile_text: 'nghiêm túc',
      p_limit: 20,
      p_offset: 40,
    });
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty('p_verified');
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty('p_favorited');
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty('p_viewed_me');
  });

  it('validates and returns the privacy-safe result shape', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [{
        id: '19000000-0000-0000-0000-000000000002',
        username: 'lan',
        display_name: 'Lan',
        headline: 'Fine dining',
        bio: null,
        gender: 'female',
        age: 29,
        province_id: 79,
        province_name: 'Thành phố Hồ Chí Minh',
        avatar_media_id: null,
        avatar_storage_bucket: null,
        avatar_storage_path: null,
        photo_count: 2,
        interests: ['Du lịch'],
        height_cm: 165,
        weight_kg: 52,
        relationship_status: 'single',
        children_status: 'no_children',
        smoking_status: 'never',
        drinking_status: 'socially',
        education_level: 'masters',
        occupation: 'Kiến trúc sư',
        looking_for: 'Lâu dài',
        lifestyle_tags: ['fine_dining', 'long_term'],
        languages: ['Tiếng Việt'],
        last_active_at: '2026-08-11T15:00:00.000Z',
        is_online: true,
        distance_km: 0.7,
        member_since: '2026-08-01T00:00:00.000Z',
      }],
    });

    const result = await searchLuxyProfilesV2({ rpc } as never);
    expect(result[0]).toMatchObject({ age: 29, distance_km: 0.7, photo_count: 2 });
    expect(result[0]).not.toHaveProperty('date_of_birth');
    expect(result[0]).not.toHaveProperty('latitude');
    expect(result[0]).not.toHaveProperty('longitude');
  });

  it('formats one-decimal Vietnamese distances including sub-kilometre results', () => {
    expect(formatLuxyDistance(0.7)).toBe('0,7 km');
    expect(formatLuxyDistance(2.3)).toBe('2,3 km');
    expect(formatLuxyDistance(0)).toBe('0,0 km');
    expect(formatLuxyDistance(null)).toBeNull();
  });

  it('bounds infinite-scroll pagination at 200 profiles', () => {
    expect(getNextLuxySearchOffset([24], 24, 200)).toBe(24);
    expect(getNextLuxySearchOffset([24, 10], 24, 200)).toBeUndefined();
    expect(getNextLuxySearchOffset([40, 40, 40, 40, 40], 40, 200)).toBeUndefined();
  });
});
