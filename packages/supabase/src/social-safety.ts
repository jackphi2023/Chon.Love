import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

type Client = SupabaseClient<Database>;

export const REPORT_REASON_OPTIONS = [
  { code: 'spam', label: 'Spam' },
  { code: 'harassment', label: 'Quấy rối' },
  { code: 'impersonation', label: 'Giả mạo' },
  { code: 'sexual_content', label: 'Nội dung tình dục' },
  { code: 'underage', label: 'Người chưa đủ tuổi' },
  { code: 'scam', label: 'Lừa đảo' },
  { code: 'violence', label: 'Bạo lực' },
  { code: 'other', label: 'Khác' },
] as const;

export type ReportReasonCode = (typeof REPORT_REASON_OPTIONS)[number]['code'];
export type SocialConnectionView = 'friends' | 'received' | 'sent';

const profileViewerSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  display_name: z.string().nullable(),
  bio: z.string().nullable(),
  gender: z.enum(['female', 'male', 'non_binary', 'other', 'prefer_not_to_say']),
  province_id: z.coerce.number().int().positive().nullable(),
  province_name: z.string().nullable(),
  avatar_media_id: z.string().uuid().nullable(),
  avatar_storage_bucket: z.string().nullable(),
  avatar_storage_path: z.string().nullable(),
  is_creator: z.boolean(),
  creator_bio: z.string().nullable(),
  interests: z.array(z.string()),
  friendship_id: z.string().uuid().nullable(),
  friendship_status: z.enum(['none', 'pending', 'accepted', 'blocked']),
  friendship_direction: z.enum(['none', 'outgoing', 'incoming', 'mutual', 'outgoing_block']),
  blocked_by_viewer: z.boolean(),
  public_album_count: z.coerce.number().int().nonnegative(),
  fan_album_available: z.boolean(),
  fan_access_granted: z.boolean(),
  fan_threshold_units: z.coerce.number().int().nonnegative(),
  fan_eligible_units: z.coerce.number().int().nonnegative(),
  fan_remaining_units: z.coerce.number().int().nonnegative(),
});

const socialConnectionSchema = z.object({
  friendship_id: z.string().uuid(),
  friendship_status: z.enum(['pending', 'accepted']),
  direction: z.enum(['incoming', 'outgoing', 'mutual']),
  greeting_message: z.string().nullable(),
  other_user_id: z.string().uuid(),
  username: z.string(),
  display_name: z.string().nullable(),
  bio: z.string().nullable(),
  province_name: z.string().nullable(),
  avatar_media_id: z.string().uuid().nullable(),
  avatar_storage_bucket: z.string().nullable(),
  avatar_storage_path: z.string().nullable(),
  is_creator: z.boolean(),
  created_at: z.string(),
  responded_at: z.string().nullable(),
});

const blockedProfileSchema = z.object({
  blocked_user_id: z.string().uuid(),
  username: z.string().nullable(),
  display_name: z.string(),
  reason_code: z.string().nullable(),
  blocked_at: z.string(),
});

const deletionStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  requested_at: z.string(),
  scheduled_delete_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  processed_at: z.string().nullable(),
  legal_hold: z.boolean(),
});

const deletionRequestSchema = z.object({
  deletion_request_id: z.string().uuid(),
  status: z.string(),
  scheduled_delete_at: z.string().nullable(),
  legal_hold: z.boolean(),
  already_processed: z.boolean(),
});

const deletionCancelSchema = z.object({
  deletion_request_id: z.string().uuid(),
  status: z.string(),
  already_processed: z.boolean(),
});

export type ProfileViewer = z.infer<typeof profileViewerSchema>;
export type SocialConnection = z.infer<typeof socialConnectionSchema>;
export type BlockedProfile = z.infer<typeof blockedProfileSchema>;
export type AccountDeletionStatus = z.infer<typeof deletionStatusSchema>;

export async function getProfileViewer(client: Client, username: string): Promise<ProfileViewer | null> {
  const { data, error } = await client.rpc('get_profile_viewer' as never, { p_username: username } as never);
  if (error) throw error;
  return z.array(profileViewerSchema).parse(data)[0] ?? null;
}

export async function listMySocialConnections(
  client: Client,
  view: SocialConnectionView,
  limit = 30,
  offset = 0,
): Promise<SocialConnection[]> {
  const { data, error } = await client.rpc(
    'list_my_social_connections' as never,
    { p_view: view, p_limit: limit, p_offset: offset } as never,
  );
  if (error) throw error;
  return z.array(socialConnectionSchema).parse(data);
}

export async function listMyBlockedProfiles(client: Client, limit = 30, offset = 0): Promise<BlockedProfile[]> {
  const { data, error } = await client.rpc(
    'list_my_blocked_profiles' as never,
    { p_limit: limit, p_offset: offset } as never,
  );
  if (error) throw error;
  return z.array(blockedProfileSchema).parse(data);
}

export async function sendFriendRequest(client: Client, addresseeId: string, greetingMessage?: string): Promise<void> {
  const { error } = await client.rpc('send_friend_request', {
    p_addressee_id: addresseeId,
    p_greeting_message: greetingMessage?.trim() || null,
  });
  if (error) throw error;
}

export async function respondToFriendRequest(client: Client, friendshipId: string, accept: boolean): Promise<void> {
  const { error } = await client.rpc('respond_to_friend_request', {
    p_friendship_id: friendshipId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function cancelFriendRequest(client: Client, friendshipId: string): Promise<void> {
  const { data, error } = await client.rpc('cancel_friend_request', { p_friendship_id: friendshipId });
  if (error) throw error;
  if (!data) throw new Error('friend_request_not_cancellable');
}

export async function blockUser(client: Client, blockedId: string, reasonCode?: string): Promise<void> {
  const { error } = await client.rpc('block_user', {
    p_blocked_id: blockedId,
    p_reason_code: reasonCode?.trim() || null,
  });
  if (error) throw error;
}

export async function unblockUser(client: Client, blockedId: string): Promise<void> {
  const { data, error } = await client.rpc('unblock_user', { p_blocked_id: blockedId });
  if (error) throw error;
  if (!data) throw new Error('block_not_found');
}

export async function createSafetyReport(
  client: Client,
  input: {
    targetUserId?: string | null;
    targetMediaId?: string | null;
    targetMessageId?: string | null;
    reasonCode: ReportReasonCode;
    description?: string | null;
  },
): Promise<string> {
  const { data, error } = await client.rpc('create_report', {
    p_target_user_id: input.targetUserId ?? null,
    p_target_media_id: input.targetMediaId ?? null,
    p_target_message_id: input.targetMessageId ?? null,
    p_reason_code: input.reasonCode,
    p_description: input.description?.trim() || null,
    p_evidence_json: {},
  });
  if (error) throw error;
  if (!data) throw new Error('report_not_created');
  return data;
}

export async function getMyAccountDeletionStatus(client: Client): Promise<AccountDeletionStatus | null> {
  const { data, error } = await client.rpc('get_my_account_deletion_status');
  if (error) throw error;
  return z.array(deletionStatusSchema).parse(data)[0] ?? null;
}

export async function requestMyAccountDeletion(
  client: Client,
  reason: string,
  idempotencyKey: string,
): Promise<z.infer<typeof deletionRequestSchema>> {
  const { data, error } = await client.rpc('request_account_deletion', {
    p_reason: reason.trim() || null,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  const row = z.array(deletionRequestSchema).parse(data)[0];
  if (!row) throw new Error('deletion_request_not_created');
  return row;
}

export async function cancelMyAccountDeletion(
  client: Client,
  deletionRequestId: string,
  requestId: string,
): Promise<z.infer<typeof deletionCancelSchema>> {
  const { data, error } = await client.rpc(
    'cancel_account_deletion' as never,
    { p_deletion_request_id: deletionRequestId, p_request_id: requestId } as never,
  );
  if (error) throw error;
  const row = z.array(deletionCancelSchema).parse(data)[0];
  if (!row) throw new Error('deletion_request_not_cancelled');
  return row;
}

export function formatHeartUnits(units: number): string {
  const normalized = Math.max(0, Math.round(units)) / 100;
  const raw = Number.isInteger(normalized) ? normalized.toFixed(0) : normalized.toFixed(2).replace(/0+$/, '');
  return raw.replace('.', ',');
}

export function getRelationshipActionLabel(profile: Pick<ProfileViewer, 'friendship_status' | 'friendship_direction'>): string {
  if (profile.friendship_status === 'blocked') return 'Bỏ chặn';
  if (profile.friendship_status === 'accepted') return 'Bạn bè';
  if (profile.friendship_status === 'pending' && profile.friendship_direction === 'incoming') return 'Phản hồi lời mời';
  if (profile.friendship_status === 'pending') return 'Hủy lời mời';
  return 'Kết bạn';
}

export function getReadableSocialError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('friendship_blocked')) return 'Không thể thực hiện vì một trong hai tài khoản đã chặn người kia.';
  if (message.includes('active_friendship_exists')) return 'Hai tài khoản đã có lời mời hoặc đã là bạn bè.';
  if (message.includes('greeting_too_long')) return 'Lời chào tối đa 280 ký tự.';
  if (message.includes('report_rate_limited')) return 'Bạn vừa gửi báo cáo tương tự. Hãy đợi một phút.';
  if (message.includes('invalid_report_reason')) return 'Lý do báo cáo không hợp lệ.';
  if (message.includes('deletion_request_not_cancellable')) return 'Yêu cầu xóa tài khoản không còn có thể hủy.';
  if (message.includes('active_deletion_request_exists')) return 'Tài khoản đã có một yêu cầu xóa đang xử lý.';
  if (message.includes('authentication_required')) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
  return 'Không thể hoàn tất thao tác. Hãy thử lại.';
}
