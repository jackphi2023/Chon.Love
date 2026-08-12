import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export type PrivatePhotoAccessStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

const statusSchema = z.enum(['pending', 'approved', 'rejected', 'revoked']);
const nullableDateSchema = z.string().nullable();

const accessStateSchema = z.object({
  owner_id: z.string().uuid(),
  private_photo_count: z.coerce.number().int().nonnegative(),
  request_id: z.string().uuid().nullable(),
  request_status: statusSchema.nullable(),
  can_view: z.boolean(),
  requested_at: nullableDateSchema,
  responded_at: nullableDateSchema,
});

const accessRequestSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  requester_id: z.string().uuid(),
  status: statusSchema,
  requested_at: z.string(),
  responded_at: nullableDateSchema,
  revoked_at: nullableDateSchema,
  updated_at: z.string(),
});

const ownerRequestSchema = z.object({
  request_id: z.string().uuid(),
  requester_id: z.string().uuid(),
  username: z.string().min(1),
  display_name: z.string().min(1),
  status: statusSchema,
  requested_at: z.string(),
  responded_at: nullableDateSchema,
  revoked_at: nullableDateSchema,
});

export type PrivatePhotoAccessState = z.infer<typeof accessStateSchema>;
export type PrivatePhotoAccessRequest = z.infer<typeof accessRequestSchema>;
export type PrivatePhotoOwnerRequest = z.infer<typeof ownerRequestSchema>;

function firstRow(value: unknown): unknown {
  if (Array.isArray(value)) return value[0];
  return value;
}

export async function getPrivatePhotoAccessState(
  client: SupabaseClient,
  ownerId: string,
): Promise<PrivatePhotoAccessState> {
  const parsedOwnerId = z.string().uuid().parse(ownerId);
  const { data, error } = await client.rpc('get_private_photo_access_state', { p_owner_id: parsedOwnerId });
  if (error) throw error;
  return accessStateSchema.parse(firstRow(data));
}

export async function requestPrivatePhotoAccess(
  client: SupabaseClient,
  ownerId: string,
): Promise<PrivatePhotoAccessRequest> {
  const parsedOwnerId = z.string().uuid().parse(ownerId);
  const { data, error } = await client.rpc('request_private_photo_access', { p_owner_id: parsedOwnerId });
  if (error) throw error;
  return accessRequestSchema.parse(firstRow(data));
}

export async function listMyPrivatePhotoAccessRequests(
  client: SupabaseClient,
  status: PrivatePhotoAccessStatus | null = null,
): Promise<PrivatePhotoOwnerRequest[]> {
  const parsedStatus = status === null ? null : statusSchema.parse(status);
  const { data, error } = await client.rpc('list_my_private_photo_access_requests', { p_status: parsedStatus });
  if (error) throw error;
  return z.array(ownerRequestSchema).parse(data ?? []);
}

export async function respondToPrivatePhotoAccessRequest(
  client: SupabaseClient,
  requestId: string,
  approve: boolean,
): Promise<PrivatePhotoAccessRequest> {
  const parsedRequestId = z.string().uuid().parse(requestId);
  const { data, error } = await client.rpc('respond_to_private_photo_access_request', {
    p_request_id: parsedRequestId,
    p_approve: approve,
  });
  if (error) throw error;
  return accessRequestSchema.parse(firstRow(data));
}

export async function revokePrivatePhotoAccess(
  client: SupabaseClient,
  requesterId: string,
): Promise<PrivatePhotoAccessRequest> {
  const parsedRequesterId = z.string().uuid().parse(requesterId);
  const { data, error } = await client.rpc('revoke_private_photo_access', { p_requester_id: parsedRequesterId });
  if (error) throw error;
  return accessRequestSchema.parse(firstRow(data));
}

export function getReadablePrivatePhotoAccessError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('private_photo_self_request_not_allowed')) return 'Bạn không thể gửi yêu cầu cho chính mình.';
  if (message.includes('private_photos_not_available')) return 'Thành viên này hiện chưa có ảnh riêng tư để chia sẻ.';
  if (message.includes('private_photo_request_blocked') || message.includes('profile_not_available')) return 'Không thể yêu cầu quyền xem ảnh riêng tư của thành viên này.';
  if (message.includes('active_adult_account_required')) return 'Tài khoản cần ở trạng thái hoạt động và xác minh đủ 18 tuổi.';
  if (message.includes('private_photo_request_not_pending')) return 'Yêu cầu này đã được xử lý.';
  if (message.includes('private_photo_access_grant_not_found')) return 'Quyền xem ảnh riêng tư không còn hiệu lực.';
  return 'Không thể cập nhật quyền xem ảnh riêng tư. Vui lòng thử lại.';
}
