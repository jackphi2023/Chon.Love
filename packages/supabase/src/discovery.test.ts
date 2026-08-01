import { describe, expect, it } from 'vitest';
import {
  deduplicateDiscoveryProfiles,
  formatApproximateDistance,
  getNextDiscoveryOffset,
  type DiscoveryProfile,
} from './discovery';

function profile(id: string): DiscoveryProfile {
  return {
    id,
    username: `user_${id}`,
    display_name: `User ${id}`,
    bio: null,
    gender: 'prefer_not_to_say',
    province_id: 79,
    province_name: 'Thành phố Hồ Chí Minh',
    avatar_media_id: null,
    avatar_storage_bucket: null,
    avatar_storage_path: null,
    is_creator: false,
    interests: [],
    last_active_at: null,
    distance_km: null,
    sort_tier: 2,
  };
}

describe('discovery helpers', () => {
  it('formats privacy-safe distance using Vietnamese decimal commas', () => {
    expect(formatApproximateDistance(0)).toBe('< 1 km');
    expect(formatApproximateDistance(0.8)).toBe('< 1 km');
    expect(formatApproximateDistance(1.5)).toBe('1,5 km');
    expect(formatApproximateDistance(2.6)).toBe('2,6 km');
    expect(formatApproximateDistance(null)).toBeNull();
  });

  it('loads on scroll without exceeding 200 profiles', () => {
    expect(getNextDiscoveryOffset([24], 24, 200)).toBe(24);
    expect(getNextDiscoveryOffset([24, 24, 10], 24, 200)).toBeUndefined();
    expect(getNextDiscoveryOffset([40, 40, 40, 40, 40], 40, 200)).toBeUndefined();
  });

  it('deduplicates profiles when cached pages overlap', () => {
    expect(deduplicateDiscoveryProfiles([profile('1'), profile('2'), profile('1')]).map((item) => item.id))
      .toEqual(['1', '2']);
  });
});
