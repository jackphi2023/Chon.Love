import {
  createRuntimeEventId,
  normalizeRuntimeError,
  recordRuntimeObservation,
  type RuntimeEventName,
  type RuntimeMetadata,
  type RuntimeSeverity,
} from '@myfan/supabase';
import { Platform } from 'react-native';
import { getMobileEnvironmentStatus } from './environment';
import { getMobileSupabaseClient } from './supabase';

export function emitMobileRuntimeObservation(input: {
  eventName: RuntimeEventName;
  severity: RuntimeSeverity;
  routeGroup: string;
  error?: unknown;
  durationMs?: number | null;
  metadata?: RuntimeMetadata;
}): void {
  const client = getMobileSupabaseClient();
  if (!client) return;
  const normalized = input.error === undefined ? null : normalizeRuntimeError(input.error);
  const environment = getMobileEnvironmentStatus();
  const releaseChannel = environment.appEnvironment === 'staging'
    ? 'staging'
    : environment.appEnvironment === 'production'
      ? 'production'
      : 'development';
  void recordRuntimeObservation(client, {
    eventId: createRuntimeEventId(),
    eventName: input.eventName,
    severity: input.severity,
    platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'mobile_web',
    releaseChannel,
    routeGroup: input.routeGroup,
    errorCode: normalized?.errorCode ?? null,
    durationMs: input.durationMs ?? null,
    metadata: {
      ...input.metadata,
      ...(normalized ? { retryable: normalized.retryable, http_status: normalized.httpStatus } : {}),
    },
  }).catch(() => {
    // Observability must never interrupt the user flow or recursively log its own failure.
  });
}
