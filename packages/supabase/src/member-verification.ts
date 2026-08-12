import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';
import type { PreparedImageUpload } from './profile-media';

type Client = SupabaseClient<Database>;

const verificationStateSchema = z.enum(['not_started', 'pending', 'approved', 'rejected']);
const memberVerificationStatusSchema = z.object({
  selfie_status: verificationStateSchema,
  selfie_similarity: z.coerce.number().nullable(),
  identity_status: verificationStateSchema,
  linkedin_status: verificationStateSchema,
  linkedin_profile_url: z.string().nullable(),
});
const memberVerificationBadgesSchema = z.object({
  selfie_verified: z.boolean(),
  identity_verified: z.boolean(),
  linkedin_verified: z.boolean(),
});
const preparedIdentityDocumentSchema = z.object({
  document_id: z.string().uuid(),
  storage_bucket: z.string().min(1),
  storage_path: z.string().min(1),
});

export type MemberVerificationState = z.infer<typeof verificationStateSchema>;
export type MemberVerificationStatus = z.infer<typeof memberVerificationStatusSchema>;
export type MemberVerificationBadges = z.infer<typeof memberVerificationBadgesSchema>;
export type MemberIdentityDocumentSide = 'front' | 'back';

function firstRow(data: unknown): unknown {
  return Array.isArray(data) ? data[0] : data;
}

export async function getMyMemberVerificationStatus(client: Client): Promise<MemberVerificationStatus> {
  const { data, error } = await client.rpc('get_my_member_verification_status' as never);
  if (error) throw error;
  return memberVerificationStatusSchema.parse(firstRow(data));
}

export async function getLuxyMemberVerificationBadges(
  client: Client,
  userId: string,
): Promise<MemberVerificationBadges> {
  const { data, error } = await client.rpc(
    'get_luxy_member_verification_badges' as never,
    { p_user_id: z.string().uuid().parse(userId) } as never,
  );
  if (error) throw error;
  return memberVerificationBadgesSchema.parse(firstRow(data));
}

export async function uploadMemberIdentityDocument(
  client: Client,
  side: MemberIdentityDocumentSide,
  image: Pick<PreparedImageUpload, 'mimeType' | 'extension' | 'bytes'>,
): Promise<string> {
  const { data: preparedData, error: prepareError } = await client.rpc(
    'prepare_member_identity_document' as never,
    {
      p_side: side,
      p_mime_type: image.mimeType,
      p_file_size_bytes: image.bytes.byteLength,
      p_extension: image.extension,
    } as never,
  );
  if (prepareError) throw prepareError;
  const prepared = preparedIdentityDocumentSchema.parse(firstRow(preparedData));

  const { error: uploadError } = await client.storage
    .from(prepared.storage_bucket)
    .upload(prepared.storage_path, image.bytes, {
      contentType: image.mimeType,
      cacheControl: '0',
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data: finalized, error: finalizeError } = await client.rpc(
    'finalize_member_identity_document' as never,
    { p_document_id: prepared.document_id } as never,
  );
  if (finalizeError) throw finalizeError;
  if (finalized !== true) throw new Error('identity_document_finalize_failed');
  return prepared.document_id;
}

export async function submitMyMemberIdentityVerification(client: Client): Promise<MemberVerificationState> {
  const { data, error } = await client.rpc('submit_my_member_identity_verification' as never);
  if (error) throw error;
  return verificationStateSchema.parse(data);
}

export async function submitMyLinkedInVerification(client: Client, profileUrl: string): Promise<MemberVerificationState> {
  const { data, error } = await client.rpc(
    'submit_my_linkedin_verification' as never,
    { p_profile_url: profileUrl.trim() } as never,
  );
  if (error) throw error;
  return verificationStateSchema.parse(data);
}

export function memberVerificationStatusLabel(status: MemberVerificationState): string {
  if (status === 'approved') return 'Đã xác minh';
  if (status === 'pending') return 'Đang xem xét';
  if (status === 'rejected') return 'Cần gửi lại';
  return 'Chưa xác minh';
}

export function getReadableMemberVerificationError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (raw.includes('identity_front_and_back_required')) return 'Cần upload đủ mặt trước và mặt sau CCCD.';
  if (raw.includes('invalid_linkedin_profile_url')) return 'Hãy nhập đúng URL hồ sơ LinkedIn dạng https://www.linkedin.com/in/...';
  if (raw.includes('invalid_identity_document_side')) return 'Mặt giấy tờ không hợp lệ.';
  if (raw.includes('unsupported_identity_mime_type')) return 'CCCD chỉ chấp nhận JPEG, PNG hoặc WebP.';
  if (raw.includes('invalid_identity_file_size')) return 'Ảnh CCCD vượt quá dung lượng cho phép.';
  return 'Không thể cập nhật xác thực lúc này. Vui lòng thử lại.';
}
