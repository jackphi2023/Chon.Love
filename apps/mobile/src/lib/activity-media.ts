import type { createPublicSupabaseClient } from '@myfan/supabase';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { z } from 'zod';

const MAX_RENDER_DIMENSION = 2048;
const MAX_ACTIVITY_BYTES = 5 * 1024 * 1024;

const preparedUploadSchema = z.object({
  media_id: z.string().uuid(),
  storage_bucket: z.string(),
  storage_path: z.string(),
});

export type PreparedActivityImage = {
  previewUri: string;
  bytes: ArrayBuffer;
  mimeType: 'image/jpeg';
  extension: 'jpg';
  width: number;
  height: number;
};

type Client = ReturnType<typeof createPublicSupabaseClient>;

export async function pickOneActivityImage(): Promise<PreparedActivityImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || (asset.type && asset.type !== 'image') || !asset.width || !asset.height) {
    throw new Error('invalid_activity_image');
  }

  const context = ImageManipulator.manipulate(asset.uri);
  const longest = Math.max(asset.width, asset.height);
  if (longest > MAX_RENDER_DIMENSION) {
    if (asset.width >= asset.height) context.resize({ width: MAX_RENDER_DIMENSION, height: null });
    else context.resize({ width: null, height: MAX_RENDER_DIMENSION });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  const response = await fetch(saved.uri);
  if (!response.ok) throw new Error('activity_image_read_failed');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_ACTIVITY_BYTES) throw new Error('activity_media_too_large_for_safe_preview');
  return {
    previewUri: saved.uri,
    bytes,
    mimeType: 'image/jpeg',
    extension: 'jpg',
    width: saved.width,
    height: saved.height,
  };
}

export async function uploadActivityImage(client: Client, image: PreparedActivityImage): Promise<string> {
  const { data: prepareData, error: prepareError } = await client.rpc('prepare_media_upload', {
    p_visibility: 'private',
    p_mime_type: image.mimeType,
    p_file_size_bytes: image.bytes.byteLength,
    p_width: image.width,
    p_height: image.height,
    p_extension: image.extension,
  });
  if (prepareError) throw prepareError;
  const prepared = preparedUploadSchema.parse(prepareData?.[0]);

  const { error: uploadError } = await client.storage
    .from(prepared.storage_bucket)
    .upload(prepared.storage_path, image.bytes, {
      contentType: image.mimeType,
      cacheControl: '60',
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { error: finalizeError } = await client.rpc('finalize_media_upload', { p_media_id: prepared.media_id });
  if (finalizeError) throw finalizeError;
  return prepared.media_id;
}

export function getReadableActivityMediaError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('too_large') || message.includes('file_size')) return 'Ảnh phải nhỏ hơn 5 MB sau khi tối ưu.';
  if (message.includes('unsupported') || message.includes('mime')) return 'MyFan chỉ nhận ảnh JPEG, PNG hoặc WebP.';
  return 'Không thể chuẩn bị ảnh. Hãy chọn một ảnh khác và thử lại.';
}
