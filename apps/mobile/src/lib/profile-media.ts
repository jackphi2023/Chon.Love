import { SaveFormat, ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import {
  profileImageMetadataSchema,
  type ProfileImageMetadata,
} from '@myfan/validation';
import type { PreparedImageUpload } from '@myfan/supabase';

const MAX_RENDER_DIMENSION = 2048;
const JPEG_COMPRESSION = 0.82;

export type ProfileImageSource = 'library' | 'camera';

export type PreparedLocalProfileImage = PreparedImageUpload & {
  previewUri: string;
  metadata: ProfileImageMetadata;
};

function getResizeTarget(width: number, height: number): { width: number | null; height: number | null } | null {
  const longest = Math.max(width, height);
  if (longest <= MAX_RENDER_DIMENSION) return null;
  if (width >= height) return { width: MAX_RENDER_DIMENSION, height: null };
  return { width: null, height: MAX_RENDER_DIMENSION };
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

  const context = ImageManipulator.manipulate(asset.uri);
  const resizeTarget = getResizeTarget(asset.width, asset.height);
  if (resizeTarget) context.resize(resizeTarget);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: JPEG_COMPRESSION,
    format: SaveFormat.JPEG,
  });

  const response = await fetch(saved.uri);
  if (!response.ok) throw new Error('image_read_failed');
  const bytes = await response.arrayBuffer();
  const metadata = profileImageMetadataSchema.parse({
    mimeType: 'image/jpeg',
    fileSizeBytes: bytes.byteLength,
    width: saved.width,
    height: saved.height,
    extension: 'jpg',
  });

  return {
    visibility,
    mimeType: metadata.mimeType,
    extension: metadata.extension,
    width: metadata.width,
    height: metadata.height,
    bytes,
    previewUri: saved.uri,
    metadata,
  };
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
): Promise<PreparedLocalProfileImage[]> {
  const assets = await selectImages('library', true);
  const prepared: PreparedLocalProfileImage[] = [];
  for (const asset of assets) {
    prepared.push(await prepareSelectedImage(asset, visibility));
  }
  return prepared;
}

export function getReadableProfileMediaError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('camera_permission_denied')) {
    return 'Luxy.Love chỉ dùng camera khi bạn chủ động chụp ảnh. Hãy cấp quyền camera để tiếp tục.';
  }
  if (message.includes('invalid_media_file_size') || message.includes('too large')) {
    return 'Ảnh vượt quá dung lượng cho phép. Hãy chọn ảnh nhỏ hơn.';
  }
  if (
    message.includes('unsupported_media') ||
    message.includes('mime') ||
    message.includes('extension')
  ) {
    return 'Luxy.Love chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.';
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
