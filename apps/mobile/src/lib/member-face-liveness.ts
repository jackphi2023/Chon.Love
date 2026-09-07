import {
  normalizeMemberPhotoVerificationResult,
  type MemberPhotoVerificationResult,
} from './member-photo-verification';
import { getMobileSupabaseClient } from './supabase';

export type MemberFaceLivenessCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: string;
};

export type MemberFaceLivenessSession = {
  sessionId: string;
  region: string;
  credentials: MemberFaceLivenessCredentials;
  expiresAt: string;
};

async function throwFunctionError(error: unknown): Promise<never> {
  const candidate = error as { message?: unknown; context?: unknown } | null;
  const response = candidate?.context instanceof Response ? candidate.context : null;
  let remoteCode = '';
  let retryAfterSeconds: number | null = null;
  if (response) {
    try {
      const payload = await response.clone().json() as { error?: unknown; retryAfterSeconds?: unknown };
      if (typeof payload.error === 'string') remoteCode = payload.error;
      if (typeof payload.retryAfterSeconds === 'number') retryAfterSeconds = payload.retryAfterSeconds;
    } catch {
      // Keep the HTTP status even when a proxy returned non-JSON content.
    }
  }
  const message = typeof candidate?.message === 'string' ? candidate.message : 'edge_function_error';
  const status = response?.status ?? 0;
  throw new Error(
    `member_face_liveness_invoke_failed:${status}:${remoteCode || message}${retryAfterSeconds == null ? '' : `:${retryAfterSeconds}`}`,
  );
}

function normalizeSession(value: unknown): MemberFaceLivenessSession {
  if (!value || typeof value !== 'object') throw new Error('invalid_liveness_session_response');
  const record = value as Record<string, unknown>;
  const credentials = record.credentials as Record<string, unknown> | null;
  if (
    typeof record.sessionId !== 'string'
    || typeof record.region !== 'string'
    || typeof record.expiresAt !== 'string'
    || !credentials
    || typeof credentials.accessKeyId !== 'string'
    || typeof credentials.secretAccessKey !== 'string'
    || typeof credentials.sessionToken !== 'string'
    || typeof credentials.expiration !== 'string'
  ) {
    throw new Error('invalid_liveness_session_response');
  }
  return {
    sessionId: record.sessionId,
    region: record.region,
    expiresAt: record.expiresAt,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
      expiration: credentials.expiration,
    },
  };
}

export async function createMemberFaceLivenessSession(
  client = getMobileSupabaseClient(),
): Promise<MemberFaceLivenessSession> {
  if (!client) throw new Error('supabase_not_configured');
  const { data, error } = await client.functions.invoke('member-face-liveness', {
    body: { action: 'create' },
  });
  if (error) return throwFunctionError(error);
  return normalizeSession(data);
}

export async function completeMemberFaceLivenessSession(
  sessionId: string,
  client = getMobileSupabaseClient(),
): Promise<MemberPhotoVerificationResult> {
  if (!client) throw new Error('supabase_not_configured');
  const { data, error } = await client.functions.invoke('member-face-liveness', {
    body: { action: 'complete', sessionId },
  });
  if (error) return throwFunctionError(error);
  return normalizeMemberPhotoVerificationResult(data);
}
