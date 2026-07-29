import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Database, Enums, Tables } from './database.types';
import type { RealtimeRowChange } from './social';

export type MediaVisibility = Exclude<Enums<'media_visibility'>, 'kyc'>;
export type MediaModerationAction = Enums<'moderation_decision'>;
export type MediaAsset = Tables<'media_assets'>;
export type Album = Tables<'albums'>;
export type AlbumMedia = Tables<'album_media'>;
export type PreparedMediaUpload = Database['public']['Functions']['prepare_media_upload']['Returns'][number];
export type OwnerMediaSummary = Database['public']['Functions']['list_my_media']['Returns'][number];
export type ProfileAlbumMedia = Database['public']['Functions']['list_profile_album_media']['Returns'][number];

export type PrepareMediaUploadInput = {
  visibility: MediaVisibility;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  fileSizeBytes: number;
  width: number;
  height: number;
  sha256?: string | null;
  extension: 'jpg' | 'jpeg' | 'png' | 'webp';
};

export type UploadPreparedMediaInput = PrepareMediaUploadInput & {
  data: ArrayBuffer;
  cacheControlSeconds?: number;
};

export type MediaUploadResult = {
  prepared: PreparedMediaUpload;
  media: MediaAsset;
};

export type SignedMediaAccess = {
  mediaId: string;
  signedUrl: string;
  expiresIn: number;
  expiresAt: string;
};

export type ModerateMediaInput = {
  mediaId: string;
  action: MediaModerationAction;
  reasonCode: string;
  notes?: string | null;
  requestId?: string;
};

export type ModerateMediaResult = {
  mediaId: string;
  moderationStatus: Enums<'media_moderation_status'>;
  requestId: string;
};

function firstOrThrow<T>(rows: T[] | null, operation: string): T {
  const row = rows?.[0];
  if (!row) throw new Error(`${operation} returned no row.`);
  return row;
}

export async function prepareMediaUpload(client: SupabaseClient<Database>, input: PrepareMediaUploadInput): Promise<PreparedMediaUpload> {
  const { data, error } = await client.rpc('prepare_media_upload', {
    p_visibility: input.visibility,
    p_mime_type: input.mimeType,
    p_file_size_bytes: input.fileSizeBytes,
    p_width: input.width,
    p_height: input.height,
    p_extension: input.extension,
    ...(input.sha256 == null ? {} : { p_sha256: input.sha256 }),
  });
  if (error) throw error;
  return firstOrThrow(data, 'prepare_media_upload');
}

export async function uploadPreparedMedia(client: SupabaseClient<Database>, prepared: PreparedMediaUpload, input: UploadPreparedMediaInput): Promise<MediaAsset> {
  if (input.data.byteLength !== input.fileSizeBytes) throw new Error('Media byte length does not match declared file size.');
  const { error: uploadError } = await client.storage.from(prepared.storage_bucket).upload(prepared.storage_path, input.data, {
    contentType: input.mimeType,
    cacheControl: String(input.cacheControlSeconds ?? 300),
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const { data, error } = await client.rpc('finalize_media_upload', { p_media_id: prepared.media_id });
  if (error) {
    await client.storage.from(prepared.storage_bucket).remove([prepared.storage_path]);
    throw error;
  }
  return data;
}

export async function uploadMediaForModeration(client: SupabaseClient<Database>, input: UploadPreparedMediaInput): Promise<MediaUploadResult> {
  const prepared = await prepareMediaUpload(client, input);
  const media = await uploadPreparedMedia(client, prepared, input);
  return { prepared, media };
}

export async function listMyMedia(client: SupabaseClient<Database>, limit = 50, cursor?: string | null): Promise<OwnerMediaSummary[]> {
  const { data, error } = await client.rpc('list_my_media', {
    p_limit: Math.min(Math.max(limit, 1), 100),
    ...(cursor == null ? {} : { p_cursor: cursor }),
  });
  if (error) throw error;
  return data ?? [];
}

export async function createAlbum(client: SupabaseClient<Database>, name: string, albumType: Enums<'album_type'>, fanThresholdUnits?: number | null): Promise<Album> {
  const { data, error } = await client.rpc('create_album', {
    p_name: name,
    p_album_type: albumType,
    ...(fanThresholdUnits == null ? {} : { p_fan_threshold_units: fanThresholdUnits }),
  });
  if (error) throw error;
  return data;
}

export async function setAlbumActive(client: SupabaseClient<Database>, albumId: string, isActive: boolean): Promise<Album> {
  const { data, error } = await client.rpc('set_album_active', { p_album_id: albumId, p_is_active: isActive });
  if (error) throw error;
  return data;
}

export async function addMediaToAlbum(client: SupabaseClient<Database>, albumId: string, mediaId: string, sortOrder = 0): Promise<boolean> {
  const { data, error } = await client.rpc('add_media_to_album', {
    p_album_id: albumId,
    p_media_id: mediaId,
    p_sort_order: Math.max(sortOrder, 0),
  });
  if (error) throw error;
  return data;
}

export async function removeMediaFromAlbum(client: SupabaseClient<Database>, albumId: string, mediaId: string): Promise<boolean> {
  const { data, error } = await client.rpc('remove_media_from_album', { p_album_id: albumId, p_media_id: mediaId });
  if (error) throw error;
  return data;
}

export async function listProfileAlbumMedia(client: SupabaseClient<Database>, ownerId: string, albumType?: Enums<'album_type'> | null): Promise<ProfileAlbumMedia[]> {
  const { data, error } = await client.rpc('list_profile_album_media', {
    p_owner_id: ownerId,
    ...(albumType == null ? {} : { p_album_type: albumType }),
  });
  if (error) throw error;
  return data ?? [];
}

export async function setMyAvatar(client: SupabaseClient<Database>, mediaId: string): Promise<boolean> {
  const { data, error } = await client.rpc('set_my_avatar', { p_media_id: mediaId });
  if (error) throw error;
  return data;
}

export async function deleteMyMedia(client: SupabaseClient<Database>, mediaId: string, requestId?: string): Promise<MediaAsset> {
  const { data, error } = await client.rpc('delete_my_media', {
    p_media_id: mediaId,
    ...(requestId ? { p_request_id: requestId } : {}),
  });
  if (error) throw error;
  return data;
}

export async function getSignedMediaAccess(client: SupabaseClient<Database>, mediaId: string, expiresIn = 120): Promise<SignedMediaAccess> {
  const { data, error } = await client.functions.invoke<SignedMediaAccess>('media-access', {
    body: { mediaId, expiresIn: Math.min(Math.max(expiresIn, 30), 300) },
  });
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('media-access returned no signed URL.');
  return data;
}

export async function moderateMedia(client: SupabaseClient<Database>, input: ModerateMediaInput): Promise<ModerateMediaResult> {
  const { data, error } = await client.functions.invoke<ModerateMediaResult>('media-moderation', {
    body: {
      mediaId: input.mediaId,
      action: input.action,
      reasonCode: input.reasonCode,
      ...(input.notes == null ? {} : { notes: input.notes }),
      ...(input.requestId ? { requestId: input.requestId } : {}),
    },
  });
  if (error) throw error;
  if (!data?.mediaId) throw new Error('media-moderation returned no media result.');
  return data;
}

export function subscribeToMyMedia(client: SupabaseClient<Database>, ownerId: string, onChange: (change: RealtimeRowChange<MediaAsset>) => void): RealtimeChannel {
  return client.channel(`owner:${ownerId}:media`).on('postgres_changes', {
    event: '*', schema: 'public', table: 'media_assets', filter: `owner_id=eq.${ownerId}`,
  }, (payload) => onChange(payload as unknown as RealtimeRowChange<MediaAsset>)).subscribe();
}

export function subscribeToMyAlbums(client: SupabaseClient<Database>, ownerId: string, onChange: (change: RealtimeRowChange<Album>) => void): RealtimeChannel {
  return client.channel(`owner:${ownerId}:albums`).on('postgres_changes', {
    event: '*', schema: 'public', table: 'albums', filter: `owner_id=eq.${ownerId}`,
  }, (payload) => onChange(payload as unknown as RealtimeRowChange<Album>)).subscribe();
}

export function subscribeToAlbumMedia(client: SupabaseClient<Database>, albumId: string, onChange: (change: RealtimeRowChange<AlbumMedia>) => void): RealtimeChannel {
  return client.channel(`album:${albumId}:media`).on('postgres_changes', {
    event: '*', schema: 'public', table: 'album_media', filter: `album_id=eq.${albumId}`,
  }, (payload) => onChange(payload as unknown as RealtimeRowChange<AlbumMedia>)).subscribe();
}
