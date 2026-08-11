import type { GenderIdentity } from '@myfan/supabase';
import type { PreparedLocalProfileImage } from './profile-media';
import { getMobileSupabaseClient } from './supabase';

export const MEMBER_PHOTO_SIMILARITY_THRESHOLD = 60;
export const MEMBER_PHOTO_PENDING_MESSAGE =
  'Ảnh chụp và ảnh upload chưa hợp lệ, chúng tôi cần xác minh để xem xét kích hoạt tài khoản hoặc vô hiệu';

export type MemberPhotoVerificationState = 'not_started' | 'pending_review' | 'approved' | 'hidden';

export type MemberPhotoVerificationResult = {
  state: MemberPhotoVerificationState;
  profileStatus?: string;
  threshold: number;
  maxSimilarity?: number | null;
  caseId?: string;
  message?: string | null;
};

type Client = NonNullable<ReturnType<typeof getMobileSupabaseClient>>;

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const triple = (first << 16) | (second << 8) | third;
    output += BASE64_ALPHABET[(triple >> 18) & 63];
    output += BASE64_ALPHABET[(triple >> 12) & 63];
    output += index + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 63] : '=';
    output += index + 2 < bytes.length ? BASE64_ALPHABET[triple & 63] : '=';
  }
  return output;
}

function requireClient(): Client {
  const client = getMobileSupabaseClient();
  if (!client) throw new Error('Supabase client is not configured.');
  return client;
}

function parseResult(data: unknown): MemberPhotoVerificationResult {
  if (!data || typeof data !== 'object') throw new Error('invalid_member_photo_verification_response');
  const payload = data as Record<string, unknown>;
  const state = payload.state;
  if (state !== 'not_started' && state !== 'pending_review' && state !== 'approved' && state !== 'hidden') {
    throw new Error('invalid_member_photo_verification_state');
  }
  return {
    state,
    profileStatus: typeof payload.profileStatus === 'string' ? payload.profileStatus : undefined,
    threshold: typeof payload.threshold === 'number' ? payload.threshold : MEMBER_PHOTO_SIMILARITY_THRESHOLD,
    maxSimilarity: typeof payload.maxSimilarity === 'number' ? payload.maxSimilarity : null,
    caseId: typeof payload.caseId === 'string' ? payload.caseId : undefined,
    message: typeof payload.message === 'string' ? payload.message : null,
  };
}

export async function getMemberPhotoVerificationStatus(
  client: Client = requireClient(),
): Promise<MemberPhotoVerificationResult> {
  const { data, error } = await client.functions.invoke('member-photo-verification', {
    body: { action: 'status' },
  });
  if (error) throw error;
  return parseResult(data);
}

export async function submitMemberPhotoVerification(
  selfie: PreparedLocalProfileImage,
  declaredGender: GenderIdentity,
  client: Client = requireClient(),
): Promise<MemberPhotoVerificationResult> {
  if (selfie.mimeType !== 'image/jpeg') throw new Error('jpeg_selfie_required');
  const { data, error } = await client.functions.invoke('member-photo-verification', {
    body: {
      action: 'submit',
      selfieBase64: arrayBufferToBase64(selfie.bytes),
      mimeType: selfie.mimeType,
      declaredGender,
    },
  });
  if (error) throw error;
  return parseResult(data);
}
