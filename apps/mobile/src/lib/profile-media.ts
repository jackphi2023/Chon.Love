import { SaveFormat, ImageManipulator } from 'expo-image-manipulator';
import {
  profileImageMetadataSchema,
  type ProfileImageMetadata,
} from '@myfan/validation';
import type { PreparedImageUpload } from '@myfan/supabase';
import { pickDeviceImage, type DeviceImageSource } from './media-picker';

const MAX_RENDER_DIMENSION = 2048;
const JPEG_COMPRESSION = 0.82;

export type ProfileImageSource = DeviceImageSource;

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

export async function pickAndPrepareProfileImage(
  source: ProfileImageSource,
  visibility: PreparedImageUpload['visibility'],
): Promise<PreparedLocalProfileImage | null> {
  const asset = await pickDeviceImage(source, {
    allowsEditing: source === 'camera',
    allowsMultipleSelection: false,
    ...(source === 'camera' ? { aspect: [1, 1] as [number, number] } : {}),
    quality: 1,
  });
  if (!asset) return null;
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

export function getReadableProfileMediaError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('camera_permission_denied')) {
    return 'MyFan chỉ dùng camera khi bạn chủ động chụp ảnh. Hãy cấp quyền camera để tiếp tục.';
  }
  if (message.includes('media_library_permission_denied')) {
    return 'MyFan cần quyền truy cập thư viện ảnh khi bạn chủ động chọn ảnh.';
  }
  if (message.includes('invalid_media_file_size') || message.includes('too large')) {
    return 'Ảnh vượt quá dung lượng cho phép. Hãy chọn ảnh nhỏ hơn.';
  }
  if (
    message.includes('unsupported_media') ||
    message.includes('mime') ||
    message.includes('extension')
  ) {
    return 'MyFan chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.';
  }
  if (message.includes('username_change_cooldown')) {
    return 'Username chỉ có thể thay đổi một lần trong 30 ngày.';
  }
  if (message.includes('duplicate key') || message.includes('profiles_username')) {
    return 'Username này đã được sử dụng.';
  }
  if (message.includes('account_not_available')) {
    return 'Tài khoản hiện không thể cập nhật hồ sơ.';
  }
  return 'Không thể hoàn tất thao tác. Hãy kiểm tra kết nối và thử lại.';
}
