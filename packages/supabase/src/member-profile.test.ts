import { describe, expect, it, vi } from 'vitest';
import { getLuxyMemberProfile, LUXY_LIFESTYLE_LABELS } from './member-profile';

const profileId = '39000000-0000-4000-8000-000000000013';

const member = {
  id: profileId,
  username: 'luxy_member',
  display_name: 'Luxy Member',
  headline: 'Kết nối có chủ đích',
  bio: 'Một hồ sơ công khai an toàn.',
  gender: 'male',
  interested_in: 'female',
  age: 32,
  province_id: 79,
  province_name: 'Thành phố Hồ Chí Minh',
  avatar_media_id: null,
  avatar_storage_bucket: null,
  avatar_storage_path: null,
  interests: ['Du lịch'],
  height_cm: 178,
  weight_kg: 74,
  relationship_status: 'single',
  children_status: 'no_children',
  smoking_status: 'never',
  drinking_status: 'socially',
  education_level: 'bachelors',
  occupation: 'Founder',
  looking_for: 'Một kết nối chất lượng.',
  lifestyle_tags: ['fine_dining', 'ready_to_travel'],
  languages: ['Tiếng Việt', 'English'],
  last_active_at: '2026-08-12T00:00:00.000Z',
  member_since: '2026-07-12T00:00:00.000Z',
  public_photo_count: 4,
  private_photo_count: 2,
  membership_tier: 'diamond',
  membership_badge_visible: true,
  blocked_by_viewer: false,
};

describe('Luxy LX-13/LX-17 Member Profile read-model client', () => {
  it('parses the privacy-safe Member Profile response and maps the legacy wire alias to true last sign-in', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null, data: [member] });
    const result = await getLuxyMemberProfile({ rpc } as never, ' luxy_member ');

    expect(rpc).toHaveBeenCalledWith('get_luxy_member_profile', { p_username: 'luxy_member' });
    expect(result).toMatchObject({
      id: profileId,
      age: 32,
      membership_tier: 'diamond',
      membership_badge_visible: true,
      public_photo_count: 4,
      private_photo_count: 2,
      last_sign_in_at: '2026-08-12T00:00:00.000Z',
    });
    expect(result).not.toHaveProperty('last_active_at');
    expect(result).not.toHaveProperty('date_of_birth');
    expect(result).not.toHaveProperty('latitude');
    expect(result).not.toHaveProperty('longitude');
    expect(result).not.toHaveProperty('kyc');
  });

  it('shows the paid membership signal independent of gender in LX-17', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [{ ...member, gender: 'female', membership_tier: 'diamond', membership_badge_visible: true }],
    });
    await expect(getLuxyMemberProfile({ rpc } as never, 'luxy_member')).resolves.toMatchObject({
      gender: 'female',
      membership_tier: 'diamond',
      membership_badge_visible: true,
    });
  });

  it('returns null for a hidden or unavailable profile', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null, data: [] });
    await expect(getLuxyMemberProfile({ rpc } as never, 'hidden_member')).resolves.toBeNull();
  });

  it('rejects malformed server payloads instead of silently trusting membership badges', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [{ ...member, membership_tier: 'vip', membership_badge_visible: true }],
    });
    await expect(getLuxyMemberProfile({ rpc } as never, 'luxy_member')).rejects.toThrow();
  });

  it('keeps Seeking-derived lifestyle labels in Vietnamese', () => {
    expect(LUXY_LIFESTYLE_LABELS.fine_dining).toBe('Ẩm thực cao cấp');
    expect(LUXY_LIFESTYLE_LABELS.ready_to_travel).toBe('Sẵn sàng du lịch');
  });
});