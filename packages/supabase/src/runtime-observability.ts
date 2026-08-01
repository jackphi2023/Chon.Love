import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

export const runtimeEventNameSchema = z.enum([
  'app_render_error',
  'auth_restore_error',
  'api_read_error',
  'api_timeout',
  'network_offline',
  'network_recovered',
  'query_retry_exhausted',
  'route_recovered',
  'accessibility_fallback',
  'circuit_opened',
]);

export const runtimeSeveritySchema = z.enum(['info', 'warning', 'error']);
export const runtimePlatformSchema = z.enum(['mobile_web', 'android', 'ios', 'admin_web', 'public_web', 'edge']);
export const runtimeReleaseChannelSchema = z.enum(['development', 'staging', 'beta', 'production']);
export const runtimeOperationClassSchema = z.enum([
  'read',
  'idempotent_write',
  'non_idempotent_write',
  'financial',
  'auth',
]);

const runtimeMetadataValueSchema = z.union([
  z.string().max(120),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const runtimeObservationResultSchema = z.object({
  observation_id: z.string().uuid(),
  already_recorded: z.boolean(),
});

const runtimeSnapshotRowSchema = z.object({
  event_name: runtimeEventNameSchema,
  severity: runtimeSeveritySchema,
  event_count: z.coerce.number().int().nonnegative(),
  affected_users: z.coerce.number().int().nonnegative(),
  retryable_count: z.coerce.number().int().nonnegative(),
  latest_at: z.string(),
});

const ALLOWED_METADATA_KEYS = new Set([
  'attempt',
  'network_state',
  'http_status',
  'feature',
  'source',
  'retryable',
  'recovered',
  'query_key_hash',
  'component',
]);

const FORBIDDEN_TELEMETRY_KEY = /(access|refresh|purchase)[_-]?token|password|email|phone|latitude|longitude|message|document|bank|legal[_-]?name|address/i;

export type RuntimeEventName = z.infer<typeof runtimeEventNameSchema>;
export type RuntimeSeverity = z.infer<typeof runtimeSeveritySchema>;
export type RuntimePlatform = z.infer<typeof runtimePlatformSchema>;
export type RuntimeReleaseChannel = z.infer<typeof runtimeReleaseChannelSchema>;
export type RuntimeOperationClass = z.infer<typeof runtimeOperationClassSchema>;
export type RuntimeMetadata = Readonly<Record<string, string | number | boolean | null>>;
export type RuntimeObservationResult = z.infer<typeof runtimeObservationResultSchema>;
export type RuntimeSnapshotRow = z.infer<typeof runtimeSnapshotRowSchema>;

type Client = SupabaseClient<Database>;
type UntypedRpc = (
  functionName: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;


export function createRuntimeEventId(random: () => number = Math.random): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.max(0, Math.min(random(), 0.999999999)) * 256));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function sanitizeRuntimeMetadata(input: Readonly<Record<string, unknown>> | undefined): RuntimeMetadata {
  if (!input) return {};
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (Object.keys(output).length >= 8) break;
    if (!ALLOWED_METADATA_KEYS.has(key) || FORBIDDEN_TELEMETRY_KEY.test(key)) continue;
    const parsed = runtimeMetadataValueSchema.safeParse(value);
    if (parsed.success) output[key] = parsed.data;
  }
  return output;
}

export function normalizeRuntimeError(error: unknown): {
  name: string;
  errorCode: string;
  httpStatus: number | null;
  retryable: boolean;
} {
  const name = error instanceof Error ? error.name : 'UnknownError';
  const httpStatus = getRuntimeHttpStatus(error) ?? null;
  const rawCode = getRuntimeErrorCode(error) ?? name;
  const errorCode = rawCode
    .toLowerCase()
    .replace(/[^a-z0-9_/-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'unknown_error';
  return {
    name: name.slice(0, 64),
    errorCode,
    httpStatus,
    retryable: isTransientRuntimeError(error),
  };
}

export function getRuntimeHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  for (const key of ['status', 'statusCode']) {
    const value = (error as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isInteger(value)) return value;
  }
  return undefined;
}

function getRuntimeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const value = (error as Record<string, unknown>).code;
  return typeof value === 'string' ? value : undefined;
}

export function isTransientRuntimeError(error: unknown): boolean {
  const status = getRuntimeHttpStatus(error);
  if (status !== undefined) return status === 408 || status === 425 || status === 429 || status >= 500;
  if (error instanceof TypeError) return true;
  if (error instanceof Error) return /network|timeout|timed out|fetch failed|connection/i.test(error.message);
  return false;
}

export function shouldRetryRuntimeRequest(
  failureCount: number,
  error: unknown,
  operationClass: RuntimeOperationClass = 'read',
): boolean {
  if (failureCount >= 2) return false;
  if (operationClass === 'financial' || operationClass === 'non_idempotent_write' || operationClass === 'auth') return false;
  return isTransientRuntimeError(error);
}

export function runtimeRetryDelayMs(attemptIndex: number, random: () => number = Math.random): number {
  const boundedAttempt = Math.max(0, Math.min(attemptIndex, 5));
  const exponential = Math.min(500 * 2 ** boundedAttempt, 8_000);
  const jitter = 0.8 + Math.max(0, Math.min(random(), 1)) * 0.4;
  return Math.round(exponential * jitter);
}

export class RuntimeCircuitBreaker {
  private failureCount = 0;
  private openedAt: number | null = null;
  private halfOpenProbeInFlight = false;

  constructor(
    private readonly options: {
      failureThreshold?: number;
      coolDownMs?: number;
      now?: () => number;
    } = {},
  ) {}

  canRequest(): boolean {
    if (this.openedAt === null) return true;
    const now = (this.options.now ?? Date.now)();
    const coolDownMs = this.options.coolDownMs ?? 30_000;
    if (now - this.openedAt < coolDownMs || this.halfOpenProbeInFlight) return false;
    this.halfOpenProbeInFlight = true;
    return true;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.openedAt = null;
    this.halfOpenProbeInFlight = false;
  }

  recordFailure(error: unknown): void {
    this.halfOpenProbeInFlight = false;
    if (!isTransientRuntimeError(error)) return;
    this.failureCount += 1;
    if (this.failureCount >= (this.options.failureThreshold ?? 3)) {
      this.openedAt = (this.options.now ?? Date.now)();
    }
  }

  getState(): 'closed' | 'open' | 'half_open' {
    if (this.openedAt === null) return 'closed';
    const now = (this.options.now ?? Date.now)();
    if (now - this.openedAt >= (this.options.coolDownMs ?? 30_000)) return 'half_open';
    return 'open';
  }
}

export async function recordRuntimeObservation(
  client: Client,
  input: {
    eventId?: string;
    eventName: RuntimeEventName;
    severity: RuntimeSeverity;
    platform: RuntimePlatform;
    releaseChannel: RuntimeReleaseChannel;
    routeGroup: string;
    errorCode?: string | null;
    durationMs?: number | null;
    metadata?: Readonly<Record<string, unknown>>;
  },
): Promise<RuntimeObservationResult> {
  const rpc = client.rpc as unknown as UntypedRpc;
  const { data, error } = await rpc('record_runtime_observability_event', {
    p_event_id: input.eventId ?? createRuntimeEventId(),
    p_event_name: runtimeEventNameSchema.parse(input.eventName),
    p_severity: runtimeSeveritySchema.parse(input.severity),
    p_platform: runtimePlatformSchema.parse(input.platform),
    p_release_channel: runtimeReleaseChannelSchema.parse(input.releaseChannel),
    p_route_group: input.routeGroup,
    p_error_code: input.errorCode ?? null,
    p_duration_ms: input.durationMs ?? null,
    p_metadata_json: sanitizeRuntimeMetadata(input.metadata),
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return runtimeObservationResultSchema.parse(row);
}

export async function invokeRuntimeObservabilityAdminSnapshot(
  client: Client,
  input: { windowMinutes?: number; requestId?: string },
): Promise<{ items: RuntimeSnapshotRow[]; requestId: string }> {
  const { data, error } = await client.functions.invoke('runtime-observability-admin', {
    body: {
      action: 'snapshot',
      windowMinutes: input.windowMinutes ?? 60,
      requestId: input.requestId ?? createRuntimeEventId(),
    },
  });
  if (error) throw new Error('runtime_observability_admin_failed');
  const parsed = z.object({
    items: z.array(runtimeSnapshotRowSchema),
    requestId: z.string().uuid(),
  }).parse(data);
  return parsed;
}

export async function listRuntimeObservabilitySnapshot(
  client: Client,
  input: { actorUserId: string; windowMinutes?: number },
): Promise<RuntimeSnapshotRow[]> {
  const rpc = client.rpc as unknown as UntypedRpc;
  const { data, error } = await rpc('admin_runtime_observability_snapshot', {
    p_actor_user_id: input.actorUserId,
    p_window_minutes: input.windowMinutes ?? 60,
  });
  if (error) throw new Error(error.message);
  return z.array(runtimeSnapshotRowSchema).parse(data);
}
