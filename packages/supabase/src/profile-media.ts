import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

type Client = SupabaseClient<Database>;

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileMediaRow = Database['public']['Tables']['media_assets']['Row'];
export type MediaVisibility = Database['public']['Enums']['media_visibility'];
export type GenderIdentity = Database['public']['Enums']['gender_identity'];
export type AlbumType = Database['public']['Enums']['album_type'];

export const VN_FEATURED_PROVINCE_COUNT = 6;
export const VN_CANONICAL_PROVINCE_COUNT = 34;

export type ProvinceOption = {
  id: number;
  name: string;
  sortOrder: number;
  areaType: 'province' | 'municipality';
};

export type UpdateMyProfileInput = {
  username: string;
  displayName: string;
  bio: string;
  gender: GenderIdentity;
  provinceId: number;
  interests: string[];
  discoveryEnabled: boolean;
  nearbyEnabled: boolean;
};

export type PreparedImageUpload = {
  visibility: Extract<MediaVisibility, 'avatar' | 'public' | 'fan'>;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
  bytes: ArrayBuffer;
  sha256?: string | null;
};

export type AlbumMediaItem = Database['public']['Functions']['list_profile_album_media']['Returns'][number];
export type MyMediaItem = Database['public']['Functions']['list_my_media']['Returns'][number];

function assertData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('missing_response_data');
  return data;
}

export async function getMyProfile(client: Client): Promise<ProfileRow> {
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('authentication_required');

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();
  return assertData(data, error);
}

export async function listActiveProvinces(client: Client): Promise<ProvinceOption[]> {
  const { data, error } = await client
    .from('administrative_areas')
    .select('id,name_vi,sort_order,area_type')
    .eq('country_code', 'VN')
    .eq('is_active', true)
    .is('parent_id', null)
    .in('area_type', ['province', 'municipality'])
    .order('sort_order', { ascending: true })
    .order('name_vi', { ascending: true });
  if (error) throw error;

  const provinces = (data ?? []).map((item) => ({
    id: item.id,
    name: item.name_vi,
    sortOrder: item.sort_order,
    areaType: item.area_type as ProvinceOption['areaType'],
  }));

  if (provinces.length !== VN_CANONICAL_PROVINCE_COUNT) {
    throw new Error('vn_province_catalog_must_contain_34_active_rows');
  }

  return provinces;
}

export async function updateMyProfile(
  client: Client,
  input: UpdateMyProfileInput,
): Promise<ProfileRow> {
  const { data, error } = await client.rpc('update_my_profile', {
    p_username: input.username,
    p_display_name: input.displayName,
    p_bio: input.bio || null,
    p_gender: input.gender,
    p_province_id: input.provinceId,
    p_interests: input.interests,
    p_discovery_enabled: input.discoveryEnabled,
    p_nearby_enabled: input.nearbyEnabled,
  });
  return assertData(data, error);
}

export async function getMediaById(
  client: Client,
  mediaId: string,
): Promise<ProfileMediaRow | null> {
  const { data, error } = await client
    .from('media_assets')
    .select('*')
    .eq('id', mediaId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMyMedia(client: Client): Promise<MyMediaItem[]> {
  const { data, error } = await client.rpc('list_my_media', { p_limit: 100, p_cursor: null });
  if (error) throw error;
  return data ?? [];
}

export async function listProfileAlbumMedia(
  client: Client,
  ownerId: string,
  albumType?: AlbumType | null,
): Promise<AlbumMediaItem[]> {
  const { data, error } = await client.rpc('list_profile_album_media', {
    p_owner_id: ownerId,
    p_album_type: albumType ?? null,
  });
  if (error) throw error;
  return data ?? [];
}

export async function createPrivateMediaUrl(
  client: Client,
  media: Pick<ProfileMediaRow, 'storage_bucket' | 'storage_path'> | Pick<AlbumMediaItem, 'storage_bucket' | 'storage_path'>,
  expiresInSeconds = 45,
): Promise<string> {
  const { data, error } = await client.storage
    .from(media.storage_bucket)
    .createSignedUrl(media.storage_path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadProfileImage(
  client: Client,
  input: PreparedImageUpload,
): Promise<ProfileMediaRow> {
  const { data: preparedRows, error: prepareError } = await client.rpc('prepare_media_upload', {
    p_visibility: input.visibility,
    p_mime_type: input.mimeType,
    p_file_size_bytes: input.bytes.byteLength,
    p_width: input.width,
    p_height: input.height,
    p_sha256: input.sha256 ?? null,
    p_extension: input.extension,
  });
  if (prepareError) throw prepareError;
  const prepared = preparedRows?.[0];
  if (!prepared) throw new Error('media_upload_not_prepared');

  const { error: uploadError } = await client.storage
    .from(prepared.storage_bucket)
    .upload(prepared.storage_path, input.bytes, {
      contentType: input.mimeType,
      cacheControl: '60',
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data, error: finalizeError } = await client.rpc('finalize_media_upload', {
    p_media_id: prepared.media_id,
  });
  return assertData(data, finalizeError);
}

export function isMediaVisibleToOwner(media: Pick<MyMediaItem, 'moderation_status' | 'deleted_at'>): boolean {
  return (
    media.deleted_at === null &&
    (media.moderation_status === 'pending_review' || media.moderation_status === 'approved')
  );
}

export function isMediaHiddenByModeration(media: Pick<MyMediaItem, 'moderation_status' | 'deleted_at'>): boolean {
  return (
    media.deleted_at !== null ||
    media.moderation_status === 'rejected' ||
    media.moderation_status === 'quarantined' ||
    media.moderation_status === 'deleted'
  );
}