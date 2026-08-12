import { describe, expect, it, vi } from 'vitest';
import {
  createLuxyUpgradeIntent,
  formatLuxyMembershipPrice,
  getMyLuxyMembershipSnapshot,
} from './membership';

const intentId = '29000000-0000-4000-8000-000000000013';

describe('Luxy LX-13 membership presentation client', () => {
  it('parses the server-controlled membership snapshot', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [{
        tier: 'diamond',
        can_message: true,
        status: 'active',
        expires_at: '2026-09-12T00:00:00.000Z',
      }],
    });

    await expect(getMyLuxyMembershipSnapshot({ rpc } as never)).resolves.toEqual({
      tier: 'diamond',
      can_message: true,
      status: 'active',
      expires_at: '2026-09-12T00:00:00.000Z',
    });
    expect(rpc).toHaveBeenCalledWith('get_my_luxy_membership_snapshot');
  });

  it('creates only a paid-plan upgrade intent and preserves source attribution', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null, data: intentId });
    await expect(createLuxyUpgradeIntent({ rpc } as never, 'premium', 'member_profile_message')).resolves.toBe(intentId);
    expect(rpc).toHaveBeenCalledWith('create_luxy_upgrade_intent', {
      p_tier: 'premium',
      p_source: 'member_profile_message',
    });
  });

  it('rejects malformed upgrade sources before hitting the backend', async () => {
    const rpc = vi.fn();
    await expect(createLuxyUpgradeIntent({ rpc } as never, 'premium', 'Member Profile!')).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('formats the two Luxy paid tiers without inventing checkout state', () => {
    expect(formatLuxyMembershipPrice('premium')).toContain('1.000.000');
    expect(formatLuxyMembershipPrice('diamond')).toContain('5.000.000');
  });
});
