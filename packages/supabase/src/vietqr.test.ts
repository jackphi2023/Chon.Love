import { describe, expect, it } from 'vitest';
import {
  VIETQR_HEART_AMOUNTS,
  formatVietqrHearts,
  formatVnd,
  getVietqrRemainingSeconds,
  getVietqrStatusLabel,
  isTrustedVietqrImageUrl,
  normalizeVietqrProducts,
  parseVietqrOrder,
} from './vietqr';

const productRows = VIETQR_HEART_AMOUNTS.map((hearts, index) => ({
  product_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  google_product_id: `myfan_hearts_${hearts}`,
  display_hearts: hearts,
  heart_units: hearts * 100,
  amount_vnd: [500_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000][index],
  sort_order: (index + 1) * 10,
}));

const orderRow = {
  order_id: '00000000-0000-4000-8000-000000000001',
  order_code: 'MFQ123456789ABC',
  status: 'pending',
  product_id: '00000000-0000-4000-8000-000000000002',
  display_hearts: 10,
  heart_units: 1_000,
  amount_vnd: 500_000,
  bank_bin: '970436',
  bank_code: 'VCB',
  bank_name: 'Vietcombank',
  account_no: '0011004000713',
  account_name: 'Tieu Vo Dinh Phi',
  transfer_content: 'MYFANMFQ123456789ABC',
  qr_image_url:
    'https://img.vietqr.io/image/VCB-0011004000713-compact2.png?amount=500000&addInfo=MYFANMFQ123456789ABC&accountName=TIEU%20VO%20DINH%20PHI',
  expires_at: '2026-07-31T10:30:00.000Z',
  submitted_at: null,
  paid_at: null,
  created_at: '2026-07-31T10:00:00.000Z',
};

describe('VietQR heart payment contract', () => {
  it('uses the final six Chon.Love heart pack sizes', () => {
    const products = normalizeVietqrProducts([...productRows].reverse());
    expect([...VIETQR_HEART_AMOUNTS]).toEqual([10, 50, 100, 200, 500, 1000]);
    expect(products.map((product) => product.display_hearts)).toEqual([...VIETQR_HEART_AMOUNTS]);
  });

  it('accepts positive server-provided pricing without recomputing it on the client', () => {
    const serverPriced = [{ ...productRows[0], amount_vnd: 620_000 }];
    expect(normalizeVietqrProducts(serverPriced)[0]?.amount_vnd).toBe(620_000);
  });

  it('still rejects inconsistent heart units', () => {
    expect(() => normalizeVietqrProducts([{ ...productRows[0], heart_units: 1 }])).toThrow(
      'vietqr_product_heart_units_mismatch',
    );
  });

  it('only trusts HTTPS images from img.vietqr.io', () => {
    expect(isTrustedVietqrImageUrl(orderRow.qr_image_url)).toBe(true);
    expect(isTrustedVietqrImageUrl('http://img.vietqr.io/image/test.png')).toBe(false);
    expect(isTrustedVietqrImageUrl('https://img.vietqr.io.evil.test/image/test.png')).toBe(false);
  });

  it('validates order account and transfer snapshots without recomputing server price', () => {
    const serverPricedOrder = { ...orderRow, amount_vnd: 620_000 };
    const order = parseVietqrOrder(serverPricedOrder);
    expect(order.amount_vnd).toBe(620_000);
    expect(order.transfer_content).toBe('MYFANMFQ123456789ABC');
  });

  it('formats payment values in Vietnamese', () => {
    expect(formatVnd(1_000_000)).toBe('1.000.000 VNĐ');
    expect(formatVietqrHearts(20)).toBe('20 ❤️');
  });

  it('calculates expiry without negative values', () => {
    expect(getVietqrRemainingSeconds('2026-07-31T10:30:00.000Z', Date.parse('2026-07-31T10:29:30.000Z'))).toBe(30);
    expect(getVietqrRemainingSeconds('2026-07-31T10:30:00.000Z', Date.parse('2026-07-31T10:31:00.000Z'))).toBe(0);
  });

  it('maps every payment status to a user-facing label', () => {
    expect(getVietqrStatusLabel('pending')).toBe('Chờ chuyển khoản');
    expect(getVietqrStatusLabel('awaiting_confirmation')).toBe('Đang chờ đối soát');
    expect(getVietqrStatusLabel('paid')).toBe('Đã xác nhận');
  });
});
