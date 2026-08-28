import { describe, expect, it, vi } from 'vitest';
import {
  formatGiftHeartPrice,
  formatHeartUnitBalance,
  getGiftCatalogContractIssues,
  normalizeGiftCatalog,
  subscribeToMyLuxyGiftTransactions,
  unsubscribeFromLuxyGiftTransactions,
  type GiftCatalogItem,
} from './gifts';

function gift(position: number, overrides: Partial<GiftCatalogItem> = {}): GiftCatalogItem {
  return {
    id: `${String(position).padStart(8, '0')}-1111-4111-8111-111111111111`,
    slug: `gift_${position}`,
    name_vi: `Quà ${position}`,
    name_en: `Gift ${position}`,
    icon_emoji: '🎁',
    icon_media_id: null,
    heart_price_units: position * 100,
    display_hearts: position,
    is_active: true,
    sort_order: position,
    updated_at: '2026-07-30T08:33:40.000Z',
    deleted_at: null,
    ...overrides,
  };
}

const validCatalog = Array.from({ length: 20 }, (_, index) => gift(index + 1));

describe('gift catalog helpers', () => {
  it('sorts active gifts and removes inactive or deleted rows', () => {
    const input = [
      gift(3),
      gift(1),
      gift(4, { is_active: false }),
      gift(5, { deleted_at: '2026-07-30T09:00:00.000Z' }),
      gift(2),
    ];
    expect(normalizeGiftCatalog(input).map((item) => item.display_hearts)).toEqual([1, 2, 3]);
  });

  it('accepts the exact Session 19 sequence of twenty gifts', () => {
    expect(getGiftCatalogContractIssues(validCatalog)).toEqual([]);
  });

  it('reports missing gifts and a mismatched heart price without changing history', () => {
    const invalid = validCatalog.slice(0, 19).map((item) => ({ ...item }));
    invalid[4] = { ...invalid[4]!, heart_price_units: 900 };
    expect(getGiftCatalogContractIssues(invalid).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['count', 'heart_price_units']),
    );
  });

  it('formats social surfaces only with hearts and never with VND', () => {
    const label = formatGiftHeartPrice(gift(20));
    expect(label).toBe('20 ❤️');
    expect(label).not.toMatch(/VNĐ|đ|50\.000|1\.000\.000/i);
  });

  it('formats fractional heart balances from integer heart units', () => {
    expect(formatHeartUnitBalance(155)).toBe('1,55 ❤️');
    expect(formatHeartUnitBalance(2_000)).toBe('20 ❤️');
  });
});

describe('OPT-09 gift realtime invalidation', () => {
  it('subscribes only to sent or received transactions for the signed-in user', () => {
    const userId = '19000000-0000-4000-8000-000000000002';
    const onChange = vi.fn();
    const channelObject = { on: vi.fn(), subscribe: vi.fn() } as {
      on: ReturnType<typeof vi.fn>;
      subscribe: ReturnType<typeof vi.fn>;
    };
    channelObject.on.mockReturnValue(channelObject);
    channelObject.subscribe.mockReturnValue(channelObject);
    const channel = vi.fn().mockReturnValue(channelObject);
    const client = { channel } as never;

    expect(subscribeToMyLuxyGiftTransactions(client, { userId, onChange })).toBe(channelObject);
    expect(channel).toHaveBeenCalledOnce();
    expect(channelObject.on).toHaveBeenCalledTimes(2);
    expect(channelObject.on.mock.calls[0]?.[1]).toEqual({
      event: '*',
      schema: 'public',
      table: 'gift_transactions',
      filter: `sender_id=eq.${userId}`,
    });
    expect(channelObject.on.mock.calls[1]?.[1]).toEqual({
      event: '*',
      schema: 'public',
      table: 'gift_transactions',
      filter: `creator_id=eq.${userId}`,
    });
    expect(channelObject.on.mock.calls[0]?.[2]).toBe(onChange);
    expect(channelObject.on.mock.calls[1]?.[2]).toBe(onChange);
    expect(channelObject.subscribe).toHaveBeenCalledOnce();
  });

  it('removes the realtime channel during page cleanup', async () => {
    const removeChannel = vi.fn().mockResolvedValue('ok');
    const client = { removeChannel } as never;
    const realtimeChannel = {} as never;

    await unsubscribeFromLuxyGiftTransactions(client, realtimeChannel);

    expect(removeChannel).toHaveBeenCalledWith(realtimeChannel);
  });
});
