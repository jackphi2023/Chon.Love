import { describe, expect, it, vi } from 'vitest';
import { searchLuxyProfilesV2 } from './search';

const resultRow = {
  id: '19000000-0000-4000-8000-000000000004',
  username: 'connect_member',
  display_name: 'Connect Member',
  headline: null,
  bio: null,
  gender: 'female',
  age: 28,
  province_id: 79,
  province_name: 'Thành phố Hồ Chí Minh',
  avatar_media_id: null,
  avatar_storage_bucket: null,
  avatar_storage_path: null,
  photo_count: 1,
  interests: [],
  height_cm: null,
  weight_kg: null,
  relationship_status: 'single',
  children_status: 'no_children',
  smoking_status: 'never',
  drinking_status: 'never',
  education_level: 'bachelors',
  occupation: null,
  looking_for: null,
  lifestyle_tags: [],
  languages: [],
  last_active_at: null,
  is_online: false,
  distance_km: null,
  member_since: '2026-08-01T00:00:00.000Z',
  is_favorited: false,
  is_favorited_by: false,
  is_viewed: false,
};

describe('Connect presentation enrichment resilience', () => {
  it('keeps core Search V2 results when the membership-badge RPC is unavailable', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [resultRow], error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function public.get_luxy_search_membership_badges' },
      });

    const result = await searchLuxyProfilesV2({ rpc } as never);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: resultRow.id,
      display_name: resultRow.display_name,
      membership_badge_tier: null,
    });
  });

  it('keeps core Search V2 results when badge payload validation fails', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [resultRow], error: null })
      .mockResolvedValueOnce({ data: [{ user_id: resultRow.id, badge_tier: 'unexpected-tier' }], error: null });

    const result = await searchLuxyProfilesV2({ rpc } as never);

    expect(result[0]?.membership_badge_tier).toBeNull();
  });

  it('still fails closed when the core Search V2 RPC fails', async () => {
    const coreError = { code: '42501', message: 'adult_onboarding_required' };
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: coreError });

    await expect(searchLuxyProfilesV2({ rpc } as never)).rejects.toBe(coreError);
    expect(rpc).toHaveBeenCalledOnce();
  });
});
