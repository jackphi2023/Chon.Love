import { describe, expect, it, vi } from 'vitest';
import {
  calculateLuxyDiamondHeartCreditDisplay,
  calculateLuxyMembershipAmountVnd,
  createLuxyMembershipOrder,
  createLuxyUpgradeIntent,
  formatLuxyMembershipAmount,
  formatLuxyMembershipPrice,
  getLuxyMembershipOrderStatusLabel,
  getMyLuxyMembershipCheckout,
  getMyLuxyMembershipSnapshot,
  isTrustedLuxyMembershipQrImageUrl,
  listMyLuxyMembershipOrders,
  updateMyLuxyMembershipPrivacy,
} from './membership';

const intentId = '29000000-0000-4000-8000-000000000013';
const orderId = '29000000-0000-4000-8000-000000000017';
const requestId = '29000000-0000-4000-8000-000000000018';

describe('Luxy LX-17/LX-18 membership engine client', () => {
  it('parses the authoritative expanded entitlement snapshot', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [{
        tier: 'diamond',
        can_message: true,
        can_favorite: true,
        can_request_private_photo: true,
        can_full_search: true,
        can_unlimited_likes: true,
        can_hide_online: true,
        can_hide_from_listing: true,
        can_use_hearts: true,
        visibility_priority: 2,
        heart_balance_units: 8_000,
        status: 'active',
        expires_at: '2026-09-12T00:00:00.000Z',
      }],
    });

    await expect(getMyLuxyMembershipSnapshot({ rpc } as never)).resolves.toMatchObject({
      tier: 'diamond',
      can_message: true,
      can_full_search: true,
      can_unlimited_likes: true,
      can_hide_online: true,
      can_hide_from_listing: true,
      can_use_hearts: true,
      visibility_priority: 2,
      heart_balance_units: 8_000,
    });
    expect(rpc).toHaveBeenCalledWith('get_my_luxy_membership_snapshot');
  });

  it('locks 1-period and 3-period prices with the 20% three-period discount', () => {
    expect(calculateLuxyMembershipAmountVnd('premium', 1)).toBe(1_000_000);
    expect(calculateLuxyMembershipAmountVnd('premium', 3)).toBe(2_400_000);
    expect(calculateLuxyMembershipAmountVnd('diamond', 1)).toBe(5_000_000);
    expect(calculateLuxyMembershipAmountVnd('diamond', 3)).toBe(12_000_000);
  });

  it('converts 80% of Diamond membership payment to display hearts at the configured reference rate', () => {
    expect(calculateLuxyDiamondHeartCreditDisplay(5_000_000)).toBe(80);
    expect(calculateLuxyDiamondHeartCreditDisplay(12_000_000)).toBe(192);
  });

  it('creates a membership order with server-snapshotted price and heart credit', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [{
        order_id: orderId,
        order_code: 'LXM0123456789AB',
        status: 'awaiting_payment',
        tier: 'diamond',
        period_count: 3,
        monthly_price_vnd: 5_000_000,
        discount_bps: 2_000,
        amount_due_vnd: 12_000_000,
        heart_credit_units: 19_200,
        created_at: '2026-08-12T12:00:00.000Z',
      }],
    });

    await expect(createLuxyMembershipOrder({ rpc } as never, 'diamond', 3, requestId, 'upgrade_billing_web')).resolves.toMatchObject({
      order_id: orderId,
      tier: 'diamond',
      period_count: 3,
      amount_due_vnd: 12_000_000,
      heart_credit_units: 19_200,
    });
    expect(rpc).toHaveBeenCalledWith('create_luxy_membership_order', {
      p_tier: 'diamond',
      p_period_count: 3,
      p_request_id: requestId,
      p_source: 'upgrade_billing_web',
    });
  });

  it('parses the caller-owned VietQR membership checkout and trusts only VietQR image host', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [{
        order_id: orderId,
        order_code: 'LXM0123456789AB',
        status: 'awaiting_payment',
        tier: 'diamond',
        period_count: 3,
        monthly_price_vnd: 5_000_000,
        discount_bps: 2_000,
        amount_due_vnd: 12_000_000,
        heart_credit_units: 19_200,
        heart_credit_display: 192,
        bank_bin: '970436',
        bank_code: 'VCB',
        bank_name: 'Vietcombank',
        account_no: '0011004000713',
        account_name: 'Tieu Vo Dinh Phi',
        transfer_content: 'LUXYLXM0123456789AB',
        qr_image_url: 'https://img.vietqr.io/image/VCB-0011004000713-compact2.png?amount=12000000&addInfo=LUXYLXM0123456789AB',
        submitted_at: null,
        membership_expires_at: null,
        created_at: '2026-08-12T12:00:00.000Z',
      }],
    });

    await expect(getMyLuxyMembershipCheckout({ rpc } as never, orderId)).resolves.toMatchObject({
      order_code: 'LXM0123456789AB',
      amount_due_vnd: 12_000_000,
      heart_credit_display: 192,
      bank_code: 'VCB',
    });
    expect(rpc).toHaveBeenCalledWith('get_my_luxy_membership_checkout', { p_order_id: orderId });
    expect(isTrustedLuxyMembershipQrImageUrl('https://img.vietqr.io/image/test.png')).toBe(true);
    expect(isTrustedLuxyMembershipQrImageUrl('https://evil.example/image.png')).toBe(false);
  });

  it('lists only caller-owned membership billing history through the RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [{
        order_id: orderId,
        order_code: 'LXM0123456789AB',
        status: 'awaiting_confirmation',
        tier: 'premium',
        period_count: 1,
        amount_due_vnd: 1_000_000,
        heart_credit_units: 0,
        membership_expires_at: null,
        submitted_at: '2026-08-12T12:05:00.000Z',
        created_at: '2026-08-12T12:00:00.000Z',
      }],
    });

    await expect(listMyLuxyMembershipOrders({ rpc } as never, { limit: 5 })).resolves.toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith('list_my_luxy_membership_orders', { p_limit: 5, p_offset: 0 });
  });

  it('sends privacy settings through the server entitlement gate', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null, data: [{ hide_online: true, hide_from_listing: false }] });
    await expect(updateMyLuxyMembershipPrivacy({ rpc } as never, { hideOnline: true, hideFromListing: false })).resolves.toEqual({
      hide_online: true,
      hide_from_listing: false,
    });
    expect(rpc).toHaveBeenCalledWith('update_my_luxy_membership_privacy', {
      p_hide_online: true,
      p_hide_from_listing: false,
    });
  });

  it('keeps the legacy LX-13 upgrade intent while LX-18 owns checkout presentation', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null, data: intentId });
    await expect(createLuxyUpgradeIntent({ rpc } as never, 'premium', 'member_profile_message')).resolves.toBe(intentId);
    expect(rpc).toHaveBeenCalledWith('create_luxy_upgrade_intent', {
      p_tier: 'premium',
      p_source: 'member_profile_message',
    });
  });

  it('rejects malformed request inputs before hitting the backend', async () => {
    const rpc = vi.fn();
    await expect(createLuxyUpgradeIntent({ rpc } as never, 'premium', 'Member Profile!')).rejects.toThrow();
    await expect(createLuxyMembershipOrder({ rpc } as never, 'premium', 3, 'bad-uuid')).rejects.toThrow();
    await expect(getMyLuxyMembershipCheckout({ rpc } as never, 'bad-uuid')).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('formats billing amounts and order statuses for the Vietnamese UI', () => {
    expect(formatLuxyMembershipPrice('premium')).toContain('1.000.000');
    expect(formatLuxyMembershipPrice('diamond')).toContain('5.000.000');
    expect(formatLuxyMembershipAmount(12_000_000)).toBe('12.000.000 đ');
    expect(getLuxyMembershipOrderStatusLabel('awaiting_confirmation')).toBe('Chờ Admin xác nhận');
    expect(getLuxyMembershipOrderStatusLabel('approved')).toBe('Đã kích hoạt');
  });
});
