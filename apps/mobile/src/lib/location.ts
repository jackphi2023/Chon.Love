import { DISCOVERY_CACHE_MS, type SetMyLocationInput } from '@myfan/supabase';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

type WebPosition = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  timestamp: number;
};

type WebPositionError = {
  code: number;
};

type WebGeolocation = {
  getCurrentPosition(
    success: (position: WebPosition) => void,
    error: (reason: WebPositionError) => void,
    options: {
      enableHighAccuracy: boolean;
      timeout: number;
      maximumAge: number;
    },
  ): void;
};

type NavigatorWithGeolocation = {
  geolocation?: WebGeolocation;
};

function toLocationInput(
  latitude: number,
  longitude: number,
  accuracy: number,
  timestamp: number,
): SetMyLocationInput {
  return {
    latitude,
    longitude,
    accuracyMeters: accuracy,
    capturedAt: new Date(timestamp || Date.now()).toISOString(),
    source: accuracy > 1_000 ? 'device_approximate' : 'device_foreground',
  };
}

async function requestWebLocation(): Promise<SetMyLocationInput> {
  const navigatorValue = (globalThis as typeof globalThis & {
    navigator?: NavigatorWithGeolocation;
  }).navigator;
  if (!navigatorValue?.geolocation) throw new Error('location_not_supported');

  return new Promise((resolve, reject) => {
    navigatorValue.geolocation?.getCurrentPosition(
      (position) => {
        resolve(
          toLocationInput(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy,
            position.timestamp,
          ),
        );
      },
      (reason) => {
        if (reason.code === 1) reject(new Error('location_permission_denied'));
        else if (reason.code === 3) reject(new Error('location_timeout'));
        else reject(new Error('location_unavailable'));
      },
      {
        enableHighAccuracy: false,
        timeout: 12_000,
        maximumAge: DISCOVERY_CACHE_MS,
      },
    );
  });
}

async function requestNativeLocation(): Promise<SetMyLocationInput> {
  const currentPermission = await Location.getForegroundPermissionsAsync();
  const permission =
    currentPermission.status === Location.PermissionStatus.GRANTED
      ? currentPermission
      : await Location.requestForegroundPermissionsAsync();

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    throw new Error('location_permission_denied');
  }

  const cached = await Location.getLastKnownPositionAsync({
    maxAge: DISCOVERY_CACHE_MS,
    requiredAccuracy: 5_000,
  });
  const result =
    cached ??
    (await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }));

  return toLocationInput(
    result.coords.latitude,
    result.coords.longitude,
    result.coords.accuracy ?? 5_000,
    result.timestamp,
  );
}

export async function requestDiscoveryLocation(): Promise<SetMyLocationInput> {
  return Platform.OS === 'web' ? requestWebLocation() : requestNativeLocation();
}
