import { SaveFormat, ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import {
  MAX_PROFILE_IMAGE_BYTES,
  MAX_PROFILE_IMAGE_DIMENSION,
  profileImageMetadataSchema,
  type ProfileImageMetadata,
} from '@myfan/validation';
import type { PreparedImageUpload } from '@myfan/supabase';

// Preserve supported JPEG/PNG/WebP uploads byte-for-byte whenever they already fit
// the server contract. Only unsupported/oversized images are re-rendered. The fallback
// starts at 4096 px / 96% JPEG quality and steps down only when necessary to remain
// below the existing 10 MB media limit, avoiding the blurry 2048px/92% legacy path.
export const PROFILE_PHOTO_FALLBACK_MAX_DIMENSION = 4096;
export const PROFILE_PHOTO_FALLBACK_JPEG_QUALITY = 0.96;

const JPEG_FALLBACK_ATTEMPTS = [
  { maxDimension: PROFILE_PHOTO_FALLBACK_MAX_DIMENSION, compression: PROFILE_PHOTO_FALLBACK_JPEG_QUALITY },
  { maxDimension: 3072, compression: 0.94 },
  { maxDimension: 2560, compression: 0.92 },
] as const;

export type ProfileImageSource = 'library' | 'camera';

export type PreparedLocalProfileImage = PreparedImageUpload & {
  previewUri: string;
  metadata: ProfileImageMetadata;
};

type SupportedOriginalFormat = {
  mimeType: PreparedLocalProfileImage['mimeType'];
  extension: PreparedLocalProfileImage['extension'];
};

function getResizeTarget(
  width: number,
  height: number,
  maxDimension: number,
): { width: number | null; height: number | null } | null {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return null;
  if (width >= height) return { width: maxDimension, height: null };
  return { width: null, height: maxDimension };
}

function supportedOriginalFormat(asset: ImagePicker.ImagePickerAsset): SupportedOriginalFormat | null {
  const mimeType = asset.mimeType?.toLowerCase();
  const fileName = asset.fileName?.toLowerCase() ?? '';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg' || /\.jpe?g$/u.test(fileName)) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (mimeType === 'image/png' || /\.png$/u.test(fileName)) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (mimeType === 'image/webp' || /\.webp$/u.test(fileName)) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  return null;
}

async function readImageBytes(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('image_read_failed');
  return response.arrayBuffer();
}

function buildPreparedImage(
  visibility: PreparedImageUpload['visibility'],
  format: SupportedOriginalFormat,
  width: number,
  height: number,
  bytes: ArrayBuffer,
  previewUri: string,
): PreparedLocalProfileImage {
  const metadata = profileImageMetadataSchema.parse({
    mimeType: format.mimeType,
    fileSizeBytes: bytes.byteLength,
    width,
    height,
    extension: format.extension,
  });
  return {
    visibility,
    mimeType: metadata.mimeType,
    extension: metadata.extension,
    width: metadata.width,
    height: metadata.height,
    bytes,
    previewUri,
    metadata,
  };
}

async function preserveOriginalImage(
  asset: ImagePicker.ImagePickerAsset,
  visibility: PreparedImageUpload['visibility'],
): Promise<PreparedLocalProfileImage | null> {
  const format = supportedOriginalFormat(asset);
  if (!format || !asset.width || !asset.height) return null;
  if (asset.width > MAX_PROFILE_IMAGE_DIMENSION || asset.height > MAX_PROFILE_IMAGE_DIMENSION) return null;

  const bytes = await readImageBytes(asset.uri);
  if (bytes.byteLength > MAX_PROFILE_IMAGE_BYTES) return null;
  return buildPreparedImage(visibility, format, asset.width, asset.height, bytes, asset.uri);
}

async function renderHighQualityJpeg(
  asset: ImagePicker.ImagePickerAsset,
  visibility: PreparedImageUpload['visibility'],
): Promise<PreparedLocalProfileImage> {
  for (const attempt of JPEG_FALLBACK_ATTEMPTS) {
    const context = ImageManipulator.manipulate(asset.uri);
    const resizeTarget = getResizeTarget(asset.width, asset.height, attempt.maxDimension);
    if (resizeTarget) context.resize(resizeTarget);
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      compress: attempt.compression,
      format: SaveFormat.JPEG,
    });
    const bytes = await readImageBytes(saved.uri);
    if (bytes.byteLength <= MAX_PROFILE_IMAGE_BYTES) {
      return buildPreparedImage(
        visibility,
        { mimeType: 'image/jpeg', extension: 'jpg' },
        saved.width,
        saved.height,
        bytes,
        saved.uri,
      );
    }
  }
  throw new Error('invalid_media_file_size');
}

async function selectImages(
  source: ProfileImageSource,
  allowsMultipleSelection: boolean,
): Promise<ImagePicker.ImagePickerAsset[]> {
  if (source === 'camera') {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error('camera_permission_denied');
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    return result.canceled ? [] : result.assets.slice(0, 1);
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection,
    quality: 1,
  });
  return result.canceled ? [] : result.assets;
}

async function prepareSelectedImage(
  asset: ImagePicker.ImagePickerAsset,
  visibility: PreparedImageUpload['visibility'],
): Promise<PreparedLocalProfileImage> {
  if (asset.type && asset.type !== 'image') throw new Error('unsupported_media_type');
  if (!asset.width || !asset.height) throw new Error('invalid_media_dimensions');

  const original = await preserveOriginalImage(asset, visibility);
  if (original) return original;
  return renderHighQualityJpeg(asset, visibility);
}

export async function pickAndPrepareProfileImage(
  source: ProfileImageSource,
  visibility: PreparedImageUpload['visibility'],
): Promise<PreparedLocalProfileImage | null> {
  const asset = (await selectImages(source, false))[0];
  if (!asset) return null;
  return prepareSelectedImage(asset, visibility);
}

export async function pickAndPrepareProfileImages(
  visibility: PreparedImageUpload['visibility'],
  maxCount?: number,
): Promise<PreparedLocalProfileImage[]> {
  const assets = await selectImages('library', true);
  const selected = typeof maxCount === 'number' ? assets.slice(0, Math.max(0, maxCount)) : assets;
  const prepared: PreparedLocalProfileImage[] = [];
  for (const asset of selected) {
    prepared.push(await prepareSelectedImage(asset, visibility));
  }
  return prepared;
}

export function getReadableProfileMediaError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('camera_permission_denied')) {
    return 'Chon.Love chỉ dùng camera khi bạn chủ động chụp ảnh. Hãy cấp quyền camera để tiếp tục.';
  }
  if (message.includes('invalid_media_file_size') || message.includes('too large')) {
    return 'Ảnh vượt quá dung lượng 10 MB sau khi tối ưu chất lượng. Hãy chọn ảnh khác.';
  }
  if (
    message.includes('unsupported_media') ||
    message.includes('mime') ||
    message.includes('extension')
  ) {
    return 'Chon.Love hỗ trợ JPEG, PNG, WebP và sẽ tự chuyển các định dạng ảnh phổ biến khác sang JPEG chất lượng cao.';
  }
  if (message.includes('username_change_cooldown')) {
    return 'Tên người dùng chỉ có thể thay đổi một lần trong 30 ngày.';
  }
  if (message.includes('duplicate key') || message.includes('profiles_username')) {
    return 'Tên người dùng này đã được sử dụng.';
  }
  if (message.includes('account_not_available')) {
    return 'Tài khoản hiện không thể cập nhật hồ sơ.';
  }
  return 'Không thể hoàn tất thao tác. Hãy kiểm tra kết nối và thử lại.';
}
