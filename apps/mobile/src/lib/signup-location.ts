import type { SignupExactLocationInput } from '@myfan/validation';
import * as Location from 'expo-location';

export const SIGNUP_LOCATION_MAX_ACCURACY_METERS = 5000;

type CapturedResult = {
  status: 'captured';
  location: SignupExactLocationInput;
};

type DeniedResult = {
  status: 'denied';
  canAskAgain: boolean;
};

type UnavailableResult = {
  status: 'unavailable';
  reason: 'services_unavailable' | 'accuracy_too_low' | 'capture_failed';
};

export type SignupLocationCaptureResult = CapturedResult | DeniedResult | UnavailableResult;

export async function captureSignupCurrentLocation(): Promise<SignupLocationCaptureResult> {
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) return { status: 'unavailable', reason: 'services_unavailable' };

    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return { status: 'denied', canAskAgain: permission.canAskAgain };
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const accuracyMeters = Math.max(0, Math.round(position.coords.accuracy ?? SIGNUP_LOCATION_MAX_ACCURACY_METERS));
    if (accuracyMeters > SIGNUP_LOCATION_MAX_ACCURACY_METERS) {
      return { status: 'unavailable', reason: 'accuracy_too_low' };
    }

    const capturedDate = new Date(position.timestamp || Date.now());
    const capturedAt = Number.isNaN(capturedDate.getTime())
      ? new Date().toISOString()
      : capturedDate.toISOString();

    return {
      status: 'captured',
      location: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters,
        capturedAt,
        source: 'device_foreground',
      },
    };
  } catch {
    return { status: 'unavailable', reason: 'capture_failed' };
  }
}

export function getSignupLocationCaptureMessage(result: SignupLocationCaptureResult): string {
  if (result.status === 'captured') {
    return `Đã lấy vị trí hiện tại · độ chính xác khoảng ${result.location.accuracyMeters.toLocaleString('vi-VN')} m.`;
  }
  if (result.status === 'denied') {
    return result.canAskAgain
      ? 'Bạn chưa cho phép truy cập vị trí. Bạn vẫn có thể tiếp tục bằng cách chọn tỉnh/thành phố.'
      : 'Quyền vị trí đang bị tắt trong trình duyệt/thiết bị. Bạn vẫn có thể tiếp tục bằng tỉnh/thành phố.';
  }
  if (result.reason === 'services_unavailable') {
    return 'Dịch vụ vị trí đang tắt hoặc không khả dụng. Bạn vẫn có thể tiếp tục bằng tỉnh/thành phố.';
  }
  if (result.reason === 'accuracy_too_low') {
    return 'Vị trí hiện tại chưa đủ chính xác để dùng cho khoảng cách gần/xa. Bạn vẫn có thể tiếp tục bằng tỉnh/thành phố.';
  }
  return 'Chưa thể lấy vị trí hiện tại. Bạn vẫn có thể tiếp tục bằng tỉnh/thành phố.';
}