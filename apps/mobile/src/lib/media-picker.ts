import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type DeviceImageSource = 'library' | 'camera';

type DeviceImagePickerOptions = Pick<
  ImagePicker.ImagePickerOptions,
  'allowsEditing' | 'allowsMultipleSelection' | 'aspect' | 'quality'
>;

async function ensurePermission(source: DeviceImageSource): Promise<void> {
  if (source === 'camera') {
    const current = await ImagePicker.getCameraPermissionsAsync();
    const permission = current.granted ? current : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('camera_permission_denied');
    return;
  }

  // The browser file chooser owns its own permission UX. Native library access
  // is requested explicitly so denial is deterministic and testable.
  if (Platform.OS === 'web') return;
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  const permission = current.granted ? current : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('media_library_permission_denied');
}

export async function pickDeviceImage(
  source: DeviceImageSource,
  options: DeviceImagePickerOptions = {},
): Promise<ImagePicker.ImagePickerAsset | null> {
  await ensurePermission(source);
  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: options.allowsEditing ?? false,
    allowsMultipleSelection: options.allowsMultipleSelection ?? false,
    quality: options.quality ?? 1,
    ...(options.aspect ? { aspect: options.aspect } : {}),
  };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(pickerOptions)
    : await ImagePicker.launchImageLibraryAsync(pickerOptions);
  return result.canceled ? null : (result.assets[0] ?? null);
}
