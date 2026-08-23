import type { GenderIdentity } from '@myfan/supabase';
import type { PreparedLocalProfileImage } from './profile-media';
import { getMobileSupabaseClient } from './supabase';

export const MEMBER_PHOTO_SIMILARITY_THRESHOLD = 60;
export const MEMBER_PHOTO_PENDING_MESSAGE =
  'Ảnh xác minh cần được kiểm tra thêm trước khi hồ sơ có thể kích hoạt.';

export type MemberPhotoVerificationState = 'not_started' | 'pending_review' | 'approved' | 'hidden';

export type MemberPhotoVerificationResult = {
  state: MemberPhotoVerificationState;
  profileStatus?: string;
  threshold: number;
  provider?: string | null;
  providerConfigured?: boolean;
  providerMetric?: 'percent' | 'cosine' | string | null;
  localCosineThreshold?: number | null;
  localMinimumStrongMatches?: number | null;
  maxSimilarity?: number | null;
  caseId?: string;
  message?: string | null;
  reason?: string | null;
  retryable?: boolean;
};

async function throwFunctionError(error: unknown): Promise<never> {
  const candidate = error as { message?: unknown; context?: unknown } | null;
  const response = candidate?.context instanceof Response ? candidate.context : null;
  let remoteCode = '';
  if (response) {
    try {
      const payload = await response.clone().json() as { error?: unknown };
      if (typeof payload.error === 'string') remoteCode = payload.error;
    } catch {
      // A non-JSON proxy response still carries the HTTP status below.
    }
  }
  const message = typeof candidate?.message === 'string' ? candidate.message : 'edge_function_error';
  const status = response?.status ?? 0;
  throw new Error(`member_photo_verification_invoke_failed:${status}:${remoteCode || message}`);
}

export async function getMemberPhotoVerificationStatus(
  client = getMobileSupabaseClient(),
): Promise<MemberPhotoVerificationResult> {
  if (!client) throw new Error('supabase_not_configured');
  const { data, error } = await client.functions.invoke('member-photo-verification', {
    body: { action: 'status' },
  });
  if (error) return throwFunctionError(error);
  return normalizeMemberPhotoVerificationResult(data);
}

export async function submitMemberPhotoVerification(
  selfie: PreparedLocalProfileImage,
  declaredGender: GenderIdentity,
  client = getMobileSupabaseClient(),
): Promise<MemberPhotoVerificationResult> {
  if (!client) throw new Error('supabase_not_configured');
  if (selfie.mimeType !== 'image/jpeg') throw new Error('jpeg_selfie_required');
  const bytes = new Uint8Array(selfie.bytes);
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('invalid_selfie_size');
  const base64 = bytesToBase64(bytes);
  const { data, error } = await client.functions.invoke('member-photo-verification', {
    body: {
      action: 'submit',
      mimeType: 'image/jpeg',
      selfieBase64: base64,
      declaredGender,
    },
  });
  if (error) return throwFunctionError(error);
  return normalizeMemberPhotoVerificationResult(data);
}

export function normalizeMemberPhotoVerificationResult(value: unknown): MemberPhotoVerificationResult {
  if (!value || typeof value !== 'object') throw new Error('invalid_verification_response');
  const record = value as Record<string, unknown>;
  const state = record.state;
  if (state !== 'not_started' && state !== 'pending_review' && state !== 'approved' && state !== 'hidden') {
    throw new Error('invalid_verification_state');
  }
  return {
    state,
    threshold: typeof record.threshold === 'number' ? record.threshold : MEMBER_PHOTO_SIMILARITY_THRESHOLD,
    ...(typeof record.profileStatus === 'string' ? { profileStatus: record.profileStatus } : {}),
    provider: typeof record.provider === 'string' ? record.provider : null,
    providerConfigured: record.providerConfigured === true,
    providerMetric: typeof record.providerMetric === 'string' ? record.providerMetric : null,
    localCosineThreshold: typeof record.localCosineThreshold === 'number' ? record.localCosineThreshold : null,
    localMinimumStrongMatches: typeof record.localMinimumStrongMatches === 'number' ? record.localMinimumStrongMatches : null,
    maxSimilarity: typeof record.maxSimilarity === 'number' ? record.maxSimilarity : null,
    ...(typeof record.caseId === 'string' ? { caseId: record.caseId } : {}),
    message: typeof record.message === 'string' ? record.message : null,
    reason: typeof record.reason === 'string' ? record.reason : null,
    retryable: record.retryable === true,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunk, bytes.length)));
  }
  return btoa(binary);
}
