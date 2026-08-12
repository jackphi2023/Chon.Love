import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

type Client = SupabaseClient;

const privatePhotoStatusSchema = z.enum(['not_requested', 'pending', 'approved', 'declined', 'revoked', 'unavailable']);

const privatePhotoAccessStateSchema = z.object({
  request_id: z.string().uuid().nullable(),
  status: privatePhotoStatusSchema,
  has_access: z.boolean(),
  can_request: z.boolean(),
  private_photo_count: z.number().int().nonnegative(),
});

const privatePhotoRequestSchema = z.object({
  request_id: z.string().uuid(),
  status: z.enum(['pending', 'approved', 'declined', 'revoked']),
  requested_at: z.string(),
});

const receivedPrivatePhotoRequestSchema = z.object({
  request_id: z.string().uuid(),
  requester_id: z.string().uuid(),
  username: z.string(),
  display_name: z.string().nullable(),
  avatar_media_id: z.string().uuid().nullable(),
  avatar_storage_bucket: z.string().nullable(),
  avatar_storage_path: z.string().nullable(),
  status: z.enum(['pending', 'approved', 'declined', 'revoked']),
  requested_at: z.string(),
  responded_at: z.string().nullable(),
});

const privatePhotoMediaSchema = z.object({
  media_id: z.string().uuid(),
  storage_bucket: z.string(),
  storage_path: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  created_at: z.string(),
});

export type PrivatePhotoAccessState = z.infer<typeof privatePhotoAccessStateSchema>;
export type ReceivedPrivatePhotoRequest = z.infer<typeof receivedPrivatePhotoRequestSchema>;
export type PrivatePhotoMediaItem = z.infer<typeof privatePhotoMediaSchema>;
export type PrivatePhotoRequestStatus = ReceivedPrivatePhotoRequest['status'];

function firstRow(data: unknown): unknown {
  return Array.isArray(data) ? data[0] : data;
}

export async function getPrivatePhotoAccessState(client: Client, ownerId: string): Promise<PrivatePhotoAccessState> {
  const { data, error } = await client.rpc('get_private_photo_access_state', { p_owner_id: ownerId });
  if (error) throw error;
  return privatePhotoAccessStateSchema.parse(firstRow(data));
}

export async function requestPrivatePhotoAccess(client: Client, ownerId: string): Promise<{ request_id: string; status: 'pending' | 'approved' | 'declined' | 'revoked'; requested_at: string }> {
  const { data, error } = await client.rpc('request_private_photo_access', { p_owner_id: ownerId });
  if (error) throw error;
  return privatePhotoRequestSchema.parse(firstRow(data));
}

export async function listReceivedPrivatePhotoRequests(
  client: Client,
  status?: PrivatePhotoRequestStatus | null,
): Promise<ReceivedPrivatePhotoRequest[]> {
  const { data, error } = await client.rpc('list_received_private_photo_requests', {
    ...(status ? { p_status: status } : {}),
  });
  if (error) throw error;
  return z.array(receivedPrivatePhotoRequestSchema).parse(data ?? []);
}

export async function respondPrivatePhotoAccess(
  client: Client,
  requestId: string,
  decision: 'approved' | 'declined',
): Promise<{ request_id: string; status: 'approved' | 'declined'; responded_at: string | null }> {
  const { data, error } = await client.rpc('respond_private_photo_access', {
    p_request_id: requestId,
    p_decision: decision,
  });
  if (error) throw error;
  const parsed = z.object({
    request_id: z.string().uuid(),
    status: z.enum(['approved', 'declined']),
    responded_at: z.string().nullable(),
  }).parse(firstRow(data));
  return parsed;
}

export async function revokePrivatePhotoAccess(client: Client, requestId: string): Promise<boolean> {
  const { data, error } = await client.rpc('revoke_private_photo_access', { p_request_id: requestId });
  if (error) throw error;
  return z.boolean().parse(data);
}

export async function listProfilePrivateMedia(client: Client, ownerId: string): Promise<PrivatePhotoMediaItem[]> {
  const { data, error } = await client.rpc('list_profile_private_media', { p_owner_id: ownerId });
  if (error) throw error;
  return z.array(privatePhotoMediaSchema).parse(data ?? []);
}

export async function getLuxyProfileConversation(client: Client, profileId: string): Promise<string | null> {
  const { data, error } = await client.rpc('get_luxy_profile_conversation', { p_profile_id: profileId });
  if (error) throw error;
  return z.string().uuid().nullable().parse(data);
}

export function getReadablePrivatePhotoError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (raw.includes('premium_membership_required')) return 'Cần Premium để sử dụng tính năng này.';
  if (raw.includes('private_photo_approval_required')) return 'Chủ hồ sơ chưa cấp quyền xem ảnh riêng tư.';
  if (raw.includes('private_photo_not_available')) return 'Hồ sơ này chưa có ảnh riêng tư đã được duyệt.';
  if (raw.includes('private_photo_target_not_available')) return 'Không thể gửi yêu cầu tới hồ sơ này.';
  if (raw.includes('private_photo_request_not_available')) return 'Yêu cầu này không còn khả dụng.';
  return 'Không thể cập nhật quyền xem ảnh riêng tư lúc này. Vui lòng thử lại.';
}
