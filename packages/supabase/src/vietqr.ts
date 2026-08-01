import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

export const VIETQR_HEART_AMOUNTS = [5, 10, 20, 50, 100, 200, 500] as const;
export const VIETQR_VND_PER_HEART = 50_000;
export const VIETQR_IMAGE_HOST = 'img.vietqr.io';

const vietqrHeartProductSchema = z.object({
  product_id: z.string().uuid(),
  google_product_id: z.string().trim().min(3).max(100),
  display_hearts: z.coerce.number().int().positive(),
  heart_units: z.coerce.number().int().positive(),
  amount_vnd: z.coerce.number().int().positive(),
  sort_order: z.coerce.number().int().nonnegative(),
});

export const vietqrPaymentStatusSchema = z.enum([
  'pending',
  'awaiting_confirmation',
  'paid',
  'expired',
  'cancelled',
  'rejected',
]);

const vietqrOrderSchema = z.object({
  order_id: z.string().uuid(),
  order_code: z.string().regex(/^MFQ[0-9A-F]{12}$/),
  status: vietqrPaymentStatusSchema,
  product_id: z.string().uuid(),
  display_hearts: z.coerce.number().int().positive(),
  heart_units: z.coerce.number().int().positive(),
  amount_vnd: z.coerce.number().int().positive(),
  bank_bin: z.string().regex(/^\d{6}$/),
  bank_code: z.string().trim().min(2).max(12),
  bank_name: z.string().trim().min(2).max(80),
  account_no: z.string().trim().min(6).max(19),
  account_name: z.string().trim().min(3).max(80),
  transfer_content: z.string().regex(/^MYFANMFQ[0-9A-F]{12}$/),
  qr_image_url: z.string().url(),
  expires_at: z.string(),
  submitted_at: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  created_at: z.string(),
});

export type VietqrHeartProduct = z.infer<typeof vietqrHeartProductSchema>;
export type VietqrPaymentStatus = z.infer<typeof vietqrPaymentStatusSchema>;
export type VietqrHeartOrder = z.infer<typeof vietqrOrderSchema>;

type Client = SupabaseClient<Database>;

export const vietqrQueryKeys = {
  all: ['vietqr-heart-payments'] as const,
  products: ['vietqr-heart-payments', 'products'] as const,
  order: (orderId: string | null) => ['vietqr-heart-payments', 'order', orderId] as const,
};

export function normalizeVietqrProducts(input: unknown): VietqrHeartProduct[] {
  const products = z.array(vietqrHeartProductSchema).parse(input).sort((left, right) => {
    return left.sort_order - right.sort_order || left.display_hearts - right.display_hearts;
  });
  for (const product of products) {
    if (product.heart_units !== product.display_hearts * 100) {
      throw new Error('vietqr_product_heart_units_mismatch');
    }
    if (product.amount_vnd !== product.display_hearts * VIETQR_VND_PER_HEART) {
      throw new Error('vietqr_product_amount_mismatch');
    }
  }
  return products;
}

export function parseVietqrOrder(input: unknown): VietqrHeartOrder {
  const order = vietqrOrderSchema.parse(input);
  if (!isTrustedVietqrImageUrl(order.qr_image_url)) throw new Error('untrusted_vietqr_image_url');
  if (order.heart_units !== order.display_hearts * 100) {
    throw new Error('vietqr_order_heart_units_mismatch');
  }
  if (order.amount_vnd !== order.display_hearts * VIETQR_VND_PER_HEART) {
    throw new Error('vietqr_order_amount_mismatch');
  }
  return order;
}

export function isTrustedVietqrImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === VIETQR_IMAGE_HOST;
  } catch {
    return false;
  }
}

export function formatVnd(amount: number): string {
  return `${Math.max(0, Math.round(amount)).toLocaleString('vi-VN')} VNĐ`;
}

export function formatVietqrHearts(hearts: number): string {
  return `${Math.max(0, Math.round(hearts)).toLocaleString('vi-VN')} ❤️`;
}

export function getVietqrStatusLabel(status: VietqrPaymentStatus): string {
  switch (status) {
    case 'pending':
      return 'Chờ chuyển khoản';
    case 'awaiting_confirmation':
      return 'Đang chờ đối soát';
    case 'paid':
      return 'Đã xác nhận';
    case 'expired':
      return 'Mã QR đã hết hạn';
    case 'cancelled':
      return 'Đã hủy';
    case 'rejected':
      return 'Không được xác nhận';
  }
}

export function getVietqrRemainingSeconds(expiresAt: string, nowMs = Date.now()): number {
  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return 0;
  return Math.max(0, Math.ceil((expiresMs - nowMs) / 1000));
}

export async function listVietqrHeartProducts(client: Client): Promise<VietqrHeartProduct[]> {
  const { data, error } = await client.rpc('list_vietqr_heart_products' as never);
  if (error) throw error;
  return normalizeVietqrProducts(data);
}

export async function createVietqrHeartOrder(
  client: Client,
  input: { productId: string; requestId: string },
): Promise<VietqrHeartOrder> {
  const { data, error } = await client.rpc('create_vietqr_heart_order' as never, {
    p_product_id: input.productId,
    p_request_id: input.requestId,
  } as never);
  if (error) throw error;
  const row = z.array(z.unknown()).parse(data)[0];
  if (!row) throw new Error('vietqr_order_missing');
  return parseVietqrOrder(row);
}

export async function getMyVietqrHeartOrder(
  client: Client,
  orderId: string,
): Promise<VietqrHeartOrder> {
  const { data, error } = await client.rpc('get_my_vietqr_heart_order' as never, {
    p_order_id: orderId,
  } as never);
  if (error) throw error;
  const row = z.array(z.unknown()).parse(data)[0];
  if (!row) throw new Error('vietqr_order_missing');
  return parseVietqrOrder(row);
}

export async function markMyVietqrTransferSubmitted(
  client: Client,
  orderId: string,
): Promise<VietqrPaymentStatus> {
  const { data, error } = await client.rpc('mark_my_vietqr_transfer_submitted' as never, {
    p_order_id: orderId,
  } as never);
  if (error) throw error;
  return vietqrPaymentStatusSchema.parse(data);
}

export async function cancelMyVietqrHeartOrder(
  client: Client,
  orderId: string,
): Promise<VietqrPaymentStatus> {
  const { data, error } = await client.rpc('cancel_my_vietqr_heart_order' as never, {
    p_order_id: orderId,
  } as never);
  if (error) throw error;
  return vietqrPaymentStatusSchema.parse(data);
}
