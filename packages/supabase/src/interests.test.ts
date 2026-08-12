import { describe, expect, it, vi } from 'vitest';
import {
  getNextLuxyInterestsOffset,
  getProfileInterestState,
  listLuxyInterests,
  parseLuxyInterestScope,
  recordProfileView,
  setProfileFavorite,
} from './interests';

const targetId = '19000000-0000-4000-8000-000000000002';

describe('Luxy LX-12/LX-16 Interests client contract', () => {
  it('accepts only the three Seeking-derived Interest scopes', () => {
    expect(parseLuxyInterestScope('favorites')).toBe('favorites');
    expect(parseLuxyInterestScope('viewed_me')).toBe('viewed_me');
    expect(parseLuxyInterestScope('favorited_me')).toBe('favorited_me');
    expect(() => parseLuxyInterestScope('gift_fans')).toThrow();
  });

  it('sets and removes a favorite through the narrow RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [{ is_favorited: true, is_favorited_by: true, is_match: true }],
    });

    const result = await setProfileFavorite({ rpc } as never, targetId, true);
    expect(rpc).toHaveBeenCalledWith('set_profile_favorite', {
      p_profile_id: targetId,
      p_favorited: true,
    });
    expect(result).toEqual({ is_favorited: true, is_favorited_by: true, is_match: true });
  });

  it('records a profile view without exposing view-history rows directly', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null, data: true });
    await expect(recordProfileView({ rpc } as never, targetId)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('record_profile_view', { p_profile_id: targetId });
  });

  it('returns relationship state with viewed directions separated', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [{
        is_favorited: true,
        is_favorited_by: false,
        is_viewed: true,
        has_viewed_me: false,
        is_match: false,
      }],
    });
    await expect(getProfileInterestState({ rpc } as never, targetId)).resolves.toMatchObject({
      is_favorited: true,
      is_viewed: true,
      has_viewed_me: false,
    });
  });

  it('lists Seeking row fields without exposing private identity/location data', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [{
        id: targetId,
        username: 'lan',
        display_name: 'Lan',
        age: 29,
        province_name: 'Thành phố Hồ Chí Minh',
        headline: 'Du lịch, kinh doanh và sự tử tế',
        height_cm: 163,
        weight_kg: 51,
        avatar_media_id: null,
        avatar_storage_bucket: null,
        avatar_storage_path: null,
        photo_count: 2,
        last_active_at: '2026-08-11T15:00:00.000Z',
        is_online: true,
        is_favorited: true,
        is_favorited_by: false,
        is_match: false,
        interaction_at: '2026-08-11T16:00:00.000Z',
      }],
    });

    const rows = await listLuxyInterests({ rpc } as never, 'favorites', { limit: 30, offset: 10 });
    expect(rpc).toHaveBeenCalledWith('list_luxy_interests', {
      p_scope: 'favorites',
      p_limit: 30,
      p_offset: 10,
    });
    expect(rows[0]).toMatchObject({ headline: 'Du lịch, kinh doanh và sự tử tế', height_cm: 163, weight_kg: 51 });
    expect(rows[0]).not.toHaveProperty('date_of_birth');
    expect(rows[0]).not.toHaveProperty('latitude');
    expect(rows[0]).not.toHaveProperty('gift_total');
    expect(getNextLuxyInterestsOffset([24], 24, 200)).toBe(24);
    expect(getNextLuxyInterestsOffset([24, 5], 24, 200)).toBeUndefined();
  });
});
