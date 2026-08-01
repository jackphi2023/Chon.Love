import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

const ACTIVITY_BODY_MAX = 3000;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const activityPostSchema = z.object({
  post_id: z.string().uuid(),
  creator_id: z.string().uuid(),
  username: z.string().min(1),
  display_name: z.string().min(1),
  is_verified: z.boolean(),
  avatar_media_id: z.string().uuid().nullable(),
  avatar_bucket: z.string().nullable(),
  avatar_path: z.string().nullable(),
  body: z.string().min(1).max(ACTIVITY_BODY_MAX),
  content_type: z.enum(['text', 'image', 'video']),
  external_url: z.string().url().nullable(),
  external_provider: z.enum(['youtube', 'of_tv']).nullable(),
  external_video_id: z.string().nullable(),
  image_access_mode: z.string(),
  required_gift_id: z.string().uuid().nullable(),
  required_gift_name_vi: z.string().nullable(),
  required_gift_icon_emoji: z.string().nullable(),
  required_gift_hearts: z.coerce.number().int().positive().nullable(),
  required_gift_active: z.boolean().nullable(),
  moderation_status: z.enum(['draft', 'pending_review', 'approved', 'rejected', 'archived', 'deleted']),
  published_at: z.string().nullable(),
  created_at: z.string(),
  media_id: z.string().uuid().nullable(),
  preview_bucket: z.string().nullable(),
  preview_path: z.string().nullable(),
  preview_width: z.coerce.number().int().positive().nullable(),
  preview_height: z.coerce.number().int().positive().nullable(),
  original_bucket: z.string().nullable(),
  original_path: z.string().nullable(),
  original_width: z.coerce.number().int().positive().nullable(),
  original_height: z.coerce.number().int().positive().nullable(),
  is_owner: z.boolean(),
  is_unlocked: z.boolean(),
  unlock_status: z.string(),
  unlock_count: z.coerce.number().int().nonnegative(),
});

const activityAccessSchema = z.object({
  creator_id: z.string().uuid(),
  username: z.string().min(1),
  activity_visibility: z.enum(['public', 'friends', 'fans']),
  can_view: z.boolean(),
  is_owner: z.boolean(),
  is_friend: z.boolean(),
  is_fan: z.boolean(),
  gate_reason: z.enum(['none', 'login_required', 'friend_required', 'fan_required', 'unavailable']),
  fan_threshold_units: z.coerce.number().int().positive(),
  fan_eligible_units: z.coerce.number().int().nonnegative(),
  fan_remaining_units: z.coerce.number().int().nonnegative(),
  approved_post_count: z.coerce.number().int().nonnegative(),
  approved_image_count: z.coerce.number().int().nonnegative(),
});

const activityAlbumItemSchema = z.object({
  post_id: z.string().uuid(),
  media_id: z.string().uuid(),
  storage_bucket: z.string().min(1),
  storage_path: z.string().min(1),
  width: z.coerce.number().int().positive().nullable(),
  height: z.coerce.number().int().positive().nullable(),
  body: z.string(),
  published_at: z.string(),
});

const activityVisibilityUpdateSchema = z.object({
  activity_visibility: z.enum(['public', 'friends', 'fans']),
  updated_at: z.string(),
});

const createdPostSchema = z.object({
  id: z.string().uuid(),
  creator_id: z.string().uuid(),
  content_type: z.enum(['text', 'image', 'video']),
  moderation_status: z.enum(['draft', 'pending_review', 'approved', 'rejected', 'archived', 'deleted']),
});

const mediaAccessSchema = z.object({
  media_id: z.string().uuid(),
  storage_bucket: z.string().min(1),
  storage_path: z.string().min(1),
  width: z.coerce.number().int().positive().nullable(),
  height: z.coerce.number().int().positive().nullable(),
  expires_in_seconds: z.coerce.number().int().min(10).max(120),
});

const moderationQueueItemSchema = z.object({
  post_id: z.string().uuid(),
  creator_id: z.string().uuid(),
  username: z.string(),
  display_name: z.string(),
  body: z.string(),
  content_type: z.enum(['text', 'image', 'video']),
  external_url: z.string().url().nullable(),
  external_provider: z.enum(['youtube', 'of_tv']).nullable(),
  image_access_mode: z.string(),
  required_gift_name_vi: z.string().nullable(),
  required_gift_hearts: z.coerce.number().int().positive().nullable(),
  moderation_status: z.enum(['pending_review', 'rejected']),
  submitted_at: z.string(),
  media_id: z.string().uuid().nullable(),
  preview_bucket: z.string().nullable(),
  preview_path: z.string().nullable(),
  original_bucket: z.string().nullable(),
  original_path: z.string().nullable(),
  media_moderation_status: z.string().nullable(),
  unlock_count: z.coerce.number().int().nonnegative(),
  report_count: z.coerce.number().int().nonnegative(),
});

export type CreatorActivityPost = z.infer<typeof activityPostSchema>;
export type CreatorActivityAccess = z.infer<typeof activityAccessSchema>;
export type CreatorActivityAlbumItem = z.infer<typeof activityAlbumItemSchema>;
export type ActivityModerationQueueItem = z.infer<typeof moderationQueueItemSchema>;
export type ActivityContentType = CreatorActivityPost['content_type'];
export type CreatorActivityVisibility = CreatorActivityAccess['activity_visibility'];
export type ActivityReportTarget = 'post' | 'image' | 'external_link';

export type ActivityComposerInput = {
  body: string;
  mediaId?: string | null;
  externalUrl?: string | null;
};

export type NormalizedActivityVideo = {
  provider: 'youtube' | 'of_tv';
  canonicalUrl: string;
  videoId: string | null;
};

type Client = SupabaseClient<Database>;

export const activityQueryKeys = {
  access: (username: string) => ['creator-activity', 'access', username.toLowerCase()] as const,
  album: (username: string) => ['creator-activity', 'album', username.toLowerCase()] as const,
  feed: (username: string) => ['creator-activity', 'feed', username.toLowerCase()] as const,
  moderation: ['creator-activity', 'moderation'] as const,
};

function getYouTubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? null;
    return id && YOUTUBE_ID.test(id) ? id : null;
  }
  if (!['youtube.com', 'www.youtube.com'].includes(host)) return null;
  if (url.pathname === '/watch') {
    const id = url.searchParams.get('v');
    return id && YOUTUBE_ID.test(id) ? id : null;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length === 2 && ['shorts', 'embed'].includes(parts[0] ?? '')) {
    const id = parts[1] ?? null;
    return id && YOUTUBE_ID.test(id) ? id : null;
  }
  return null;
}

export function normalizeActivityVideoUrl(value: string): NormalizedActivityVideo {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500 || /\s/.test(trimmed)) throw new Error('invalid_activity_video_url');
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('invalid_activity_video_url');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('invalid_activity_video_url');
  }

  const youtubeId = getYouTubeId(url);
  if (youtubeId) {
    return {
      provider: 'youtube',
      canonicalUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
      videoId: youtubeId,
    };
  }

  if (['of.tv', 'www.of.tv'].includes(url.hostname.toLowerCase()) && url.pathname !== '/') {
    return {
      provider: 'of_tv',
      canonicalUrl: `https://of.tv${url.pathname.replace(/\/$/, '')}`,
      videoId: null,
    };
  }
  throw new Error('activity_video_provider_not_allowed');
}

export function validateActivityComposer(input: ActivityComposerInput): ActivityContentType {
  const body = input.body.trim();
  if (!body || body.length > ACTIVITY_BODY_MAX) throw new Error('invalid_activity_body');
  const hasImage = Boolean(input.mediaId);
  const hasVideo = Boolean(input.externalUrl?.trim());
  if (hasImage && hasVideo) throw new Error('activity_image_and_video_cannot_be_combined');
  if (hasVideo) {
    normalizeActivityVideoUrl(input.externalUrl ?? '');
    return 'video';
  }
  return hasImage ? 'image' : 'text';
}

export async function getCreatorActivityAccess(client: Client, username: string): Promise<CreatorActivityAccess | null> {
  const { data, error } = await client.rpc('get_creator_activity_access' as never, {
    p_creator_username: username,
  } as never);
  if (error) throw error;
  return z.array(activityAccessSchema).parse(data)[0] ?? null;
}

export async function setMyCreatorActivityVisibility(
  client: Client,
  visibility: CreatorActivityVisibility,
): Promise<z.infer<typeof activityVisibilityUpdateSchema>> {
  const { data, error } = await client.rpc('set_my_creator_activity_visibility' as never, {
    p_visibility: visibility,
  } as never);
  if (error) throw error;
  const row = z.array(activityVisibilityUpdateSchema).parse(data)[0];
  if (!row) throw new Error('creator_activity_visibility_not_updated');
  return row;
}

export async function listCreatorActivity(
  client: Client,
  username: string,
  options: { limit?: number; beforeAt?: string | null; beforeId?: string | null } = {},
): Promise<CreatorActivityPost[]> {
  const { data, error } = await client.rpc('list_creator_activity' as never, {
    p_creator_username: username,
    p_limit: options.limit ?? 20,
    p_before_at: options.beforeAt ?? null,
    p_before_id: options.beforeId ?? null,
  } as never);
  if (error) throw error;
  return z.array(activityPostSchema).parse(data);
}

export async function listCreatorActivityAlbum(
  client: Client,
  username: string,
  options: { limit?: number; offset?: number } = {},
): Promise<CreatorActivityAlbumItem[]> {
  const { data, error } = await client.rpc('list_creator_activity_album' as never, {
    p_creator_username: username,
    p_limit: options.limit ?? 24,
    p_offset: options.offset ?? 0,
  } as never);
  if (error) throw error;
  return z.array(activityAlbumItemSchema).parse(data);
}

export async function createCreatorActivityPost(
  client: Client,
  input: ActivityComposerInput,
): Promise<z.infer<typeof createdPostSchema>> {
  validateActivityComposer(input);
  const { data, error } = await client.rpc('create_creator_activity_post' as never, {
    p_body: input.body.trim(),
    p_external_url: input.externalUrl?.trim() || null,
    p_media_id: input.mediaId ?? null,
    p_image_access_mode: 'public',
    p_required_gift_id: null,
  } as never);
  if (error) throw error;
  return createdPostSchema.parse(data);
}

export async function generateCreatorActivityPreview(client: Client, postId: string): Promise<void> {
  const { error } = await client.functions.invoke('creator-activity-preview', {
    body: { post_id: postId },
  });
  if (error) throw error;
}

export async function createActivityStorageUrl(
  client: Client,
  bucket: string,
  path: string,
  expiresInSeconds = 30,
): Promise<string> {
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function getCreatorPostOriginalUrl(client: Client, postId: string): Promise<string> {
  const { data, error } = await client.rpc('get_creator_post_media_access' as never, {
    p_post_id: postId,
  } as never);
  if (error) throw error;
  const access = z.array(mediaAccessSchema).parse(data)[0];
  if (!access) throw new Error('creator_activity_media_access_denied');
  return createActivityStorageUrl(client, access.storage_bucket, access.storage_path, access.expires_in_seconds);
}

export async function reportCreatorActivity(
  client: Client,
  input: {
    postId: string;
    mediaId?: string | null;
    target: ActivityReportTarget;
    reasonCode: string;
    description?: string;
  },
): Promise<string> {
  const { data, error } = await client.rpc('report_creator_activity' as never, {
    p_post_id: input.postId,
    p_media_id: input.mediaId ?? null,
    p_target_kind: input.target,
    p_reason_code: input.reasonCode,
    p_description: input.description?.trim() || null,
  } as never);
  if (error) throw error;
  return z.string().uuid().parse(data);
}

export async function archiveCreatorActivityPost(client: Client, postId: string): Promise<void> {
  const { error } = await client.rpc('archive_creator_activity_post' as never, { p_post_id: postId } as never);
  if (error) throw error;
}

export async function deleteCreatorActivityPost(client: Client, postId: string): Promise<void> {
  const { error } = await client.rpc('delete_creator_activity_post' as never, { p_post_id: postId } as never);
  if (error) throw error;
}

export async function listActivityModerationQueue(client: Client): Promise<ActivityModerationQueueItem[]> {
  const { data, error } = await client.rpc('list_creator_activity_moderation_queue' as never, {
    p_limit: 50,
    p_offset: 0,
  } as never);
  if (error) throw error;
  return z.array(moderationQueueItemSchema).parse(data);
}

export async function moderateCreatorActivityPost(
  client: Client,
  input: { postId: string; action: 'approve' | 'reject'; reasonCode: string; notes?: string },
): Promise<void> {
  const { error } = await client.rpc('moderate_creator_activity_post' as never, {
    p_post_id: input.postId,
    p_action: input.action,
    p_reason_code: input.reasonCode,
    p_notes: input.notes?.trim() || null,
    p_request_id: crypto.randomUUID(),
  } as never);
  if (error) throw error;
}

export function getCreatorActivityVisibilityLabel(visibility: CreatorActivityVisibility): string {
  if (visibility === 'public') return 'Công khai';
  if (visibility === 'friends') return 'Bạn bè';
  return 'Chỉ Fan';
}

export function getCreatorActivityVisibilityDescription(visibility: CreatorActivityVisibility): string {
  if (visibility === 'public') return 'Mọi người có thể xem toàn bộ bài viết, ảnh, video và Album Hoạt động.';
  if (visibility === 'friends') return 'Bạn bè đã chấp nhận và Fan có thể xem toàn bộ Hoạt động.';
  return 'Chỉ Fan đang hoạt động có thể xem toàn bộ Hoạt động và Album ảnh.';
}

export function getYouTubeThumbnail(videoId: string): string {
  if (!YOUTUBE_ID.test(videoId)) throw new Error('invalid_youtube_video_id');
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function getReadableActivityError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('approved_creator_required')) return 'Chỉ Creator đã được duyệt mới có thể quản lý Hoạt động.';
  if (message.includes('invalid_activity_body')) return 'Nội dung phải có từ 1 đến 3.000 ký tự.';
  if (message.includes('image_and_video')) return 'Mỗi bài chỉ được chọn một ảnh hoặc một liên kết video.';
  if (message.includes('provider_not_allowed') || message.includes('video_url') || message.includes('youtube_video_id')) {
    return 'Liên kết video chưa hợp lệ. MyFan hiện hỗ trợ YouTube, youtu.be và OF.TV qua HTTPS.';
  }
  if (message.includes('per_post_gift_lock_retired')) return 'Quyền xem hiện được đặt cho toàn bộ Hoạt động, không khóa riêng từng ảnh.';
  if (message.includes('invalid_creator_activity_visibility')) return 'Tùy chọn quyền riêng tư Hoạt động không hợp lệ.';
  if (message.includes('insufficient_heart_balance')) return 'Số dư ❤️ chưa đủ để tặng quà.';
  if (message.includes('blocked')) return 'Nội dung này không khả dụng do cài đặt an toàn giữa hai tài khoản.';
  if (message.includes('media_access_denied')) return 'Bạn chưa có quyền xem nội dung Hoạt động này.';
  return 'Không thể hoàn tất thao tác. Hãy kiểm tra kết nối và thử lại.';
}
