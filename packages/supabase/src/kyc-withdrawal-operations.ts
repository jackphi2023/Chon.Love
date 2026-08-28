import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

export const payoutQueueKindSchema = z.enum(['kyc', 'bank', 'withdrawal']);
export const kycDecisionSchema = z.enum(['approve', 'reject']);
export const bankDecisionSchema = z.enum(['verify', 'reject', 'disable']);
export const withdrawalOperationSchema = z.enum(['approve', 'reject', 'start_processing', 'mark_paid']);

const nullableUuid = z.string().uuid().nullable();
const queueEnvelopeSchema = z.object({ items: z.array(z.record(z.string(), z.unknown())), requestId: z.string().uuid() });
const operationResultSchema = z.object({ requestId: z.string().uuid() }).passthrough();
const edgeErrorSchema = z.object({ error: z.string().min(1) });

const kycReviewPayloadSchema = z.object({
  kycProfileId: z.string().uuid(),
  userId: z.string().uuid(),
  legalName: z.string(),
  documentType: z.string(),
  documentNumber: z.string(),
  documentNumberLast4: z.string(),
  countryCode: z.string(),
  status: z.string(),
  submittedAt: z.string().nullable(),
  documentIds: z.array(z.string().uuid()),
  requestId: z.string().uuid(),
});

const bankReviewPayloadSchema = z.object({
  bankAccountId: z.string().uuid(),
  userId: z.string().uuid(),
  bankCode: z.string(),
  accountNumber: z.string(),
  accountNumberLast4: z.string(),
  accountHolder: z.string(),
  status: z.string(),
  isDefault: z.boolean(),
  requestId: z.string().uuid(),
});

const kycDocumentAccessSchema = z.object({
  kycDocumentId: z.string().uuid(),
  documentSide: z.string(),
  mimeType: z.string(),
  signedUrl: z.string().url(),
  expiresInSeconds: z.coerce.number().int().positive(),
  requestId: z.string().uuid(),
});

export const kycQueueItemSchema = z.object({
  kyc_profile_id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string(),
  status: z.string(),
  document_type: z.string().nullable(),
  document_number_last4: z.string().nullable(),
  country_code: z.string().nullable(),
  submitted_at: z.string().nullable(),
  assigned_to: nullableUuid,
  review_started_at: z.string().nullable(),
  review_due_at: z.string().nullable(),
  document_count: z.coerce.number().int().nonnegative(),
  age_minutes: z.coerce.number().int().nonnegative(),
  total_count: z.coerce.number().int().nonnegative(),
});

export const bankQueueItemSchema = z.object({
  bank_account_id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string(),
  bank_code: z.string(),
  account_number_last4: z.string(),
  status: z.string(),
  is_default: z.boolean(),
  created_at: z.string(),
  assigned_to: nullableUuid,
  review_started_at: z.string().nullable(),
  review_due_at: z.string().nullable(),
  age_minutes: z.coerce.number().int().nonnegative(),
  total_count: z.coerce.number().int().nonnegative(),
});

export const withdrawalQueueItemSchema = z.object({
  withdrawal_id: z.string().uuid(),
  creator_id: z.string().uuid(),
  display_name: z.string(),
  status: z.string(),
  requested_reward_units: z.coerce.number().int().positive(),
  amount_vnd: z.coerce.number().int().positive(),
  bank_code: z.string(),
  bank_last4: z.string(),
  requested_at: z.string(),
  assigned_to: nullableUuid,
  review_started_at: z.string().nullable(),
  review_due_at: z.string().nullable(),
  approved_by: nullableUuid,
  processing_started_by: nullableUuid,
  payment_recorded_by: nullableUuid,
  payment_reference: z.string().nullable(),
  payment_evidence_present: z.boolean(),
  age_minutes: z.coerce.number().int().nonnegative(),
  total_count: z.coerce.number().int().nonnegative(),
});

export type PayoutQueueKind = z.infer<typeof payoutQueueKindSchema>;
export type KycQueueItem = z.infer<typeof kycQueueItemSchema>;
export type BankQueueItem = z.infer<typeof bankQueueItemSchema>;
export type WithdrawalQueueItem = z.infer<typeof withdrawalQueueItemSchema>;
export type WithdrawalOperation = z.infer<typeof withdrawalOperationSchema>;
export type KycReviewPayload = z.infer<typeof kycReviewPayloadSchema>;
export type BankReviewPayload = z.infer<typeof bankReviewPayloadSchema>;
export type KycDocumentAccess = z.infer<typeof kycDocumentAccessSchema>;
type Client = SupabaseClient<Database>;

export function withdrawalOperationsForStatus(status: string): WithdrawalOperation[] {
  if (status === 'under_review') return ['approve', 'reject'];
  if (status === 'approved') return ['start_processing', 'reject'];
  if (status === 'processing') return ['mark_paid'];
  return [];
}

export function withdrawalNextStepLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Nhận hồ sơ để bắt đầu kiểm tra',
    under_review: 'Duyệt hoặc từ chối sau khi kiểm tra',
    approved: 'Cần một finance operator khác bắt đầu chuyển tiền',
    processing: 'Đối soát ngân hàng và ghi nhận chứng từ thanh toán',
    paid: 'Đã hoàn tất thanh toán',
    rejected: 'Đã từ chối và hoàn số dư khả dụng',
    cancelled: 'Người dùng đã hủy và số dư đã được hoàn lại',
    reversed: 'Giao dịch đã được đảo',
  };
  return labels[status] ?? 'Kiểm tra trạng thái trước khi thao tác';
}

async function invokePayoutAdmin(client: Client, body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await client.functions.invoke('payout-admin', { body });
  if (error) {
    const parsed = edgeErrorSchema.safeParse(data);
    throw new Error(parsed.success ? parsed.data.error : error.message);
  }
  const parsedError = edgeErrorSchema.safeParse(data);
  if (parsedError.success) throw new Error(parsedError.data.error);
  return data;
}

export async function listPayoutOperationalQueue(
  client: Client,
  input: { kind: PayoutQueueKind; status?: string | null; limit?: number; offset?: number },
): Promise<KycQueueItem[] | BankQueueItem[] | WithdrawalQueueItem[]> {
  const kind = payoutQueueKindSchema.parse(input.kind);
  const data = queueEnvelopeSchema.parse(await invokePayoutAdmin(client, {
    action: `list_${kind}_queue`,
    status: input.status ?? null,
    limit: input.limit ?? 100,
    offset: input.offset ?? 0,
  }));
  if (kind === 'kyc') return z.array(kycQueueItemSchema).parse(data.items);
  if (kind === 'bank') return z.array(bankQueueItemSchema).parse(data.items);
  return z.array(withdrawalQueueItemSchema).parse(data.items);
}

export async function startPayoutOperationalReview(
  client: Client,
  input: { kind: PayoutQueueKind; entityId: string; requestId?: string },
): Promise<Record<string, unknown>> {
  const kind = payoutQueueKindSchema.parse(input.kind);
  const idKey = kind === 'kyc' ? 'kycProfileId' : kind === 'bank' ? 'bankAccountId' : 'withdrawalId';
  return operationResultSchema.parse(await invokePayoutAdmin(client, {
    action: `start_${kind}_review`,
    [idKey]: z.string().uuid().parse(input.entityId),
    requestId: input.requestId ?? crypto.randomUUID(),
  }));
}

export async function decideKycReview(
  client: Client,
  input: { kycProfileId: string; decision: z.infer<typeof kycDecisionSchema>; reasonCode?: string | null; expiresAt?: string | null; requestId?: string },
): Promise<Record<string, unknown>> {
  return operationResultSchema.parse(await invokePayoutAdmin(client, {
    action: 'review_kyc',
    kycProfileId: z.string().uuid().parse(input.kycProfileId),
    decision: kycDecisionSchema.parse(input.decision),
    reasonCode: input.reasonCode ?? null,
    expiresAt: input.expiresAt ?? null,
    requestId: input.requestId ?? crypto.randomUUID(),
  }));
}

export async function decideBankReview(
  client: Client,
  input: { bankAccountId: string; decision: z.infer<typeof bankDecisionSchema>; reasonCode?: string | null; requestId?: string },
): Promise<Record<string, unknown>> {
  return operationResultSchema.parse(await invokePayoutAdmin(client, {
    action: 'review_bank',
    bankAccountId: z.string().uuid().parse(input.bankAccountId),
    decision: bankDecisionSchema.parse(input.decision),
    reasonCode: input.reasonCode ?? null,
    requestId: input.requestId ?? crypto.randomUUID(),
  }));
}

export async function operateWithdrawal(
  client: Client,
  input: {
    withdrawalId: string;
    operation: WithdrawalOperation;
    reasonCode?: string | null;
    paymentReference?: string | null;
    paymentEvidenceSha256?: string | null;
    requestId?: string;
  },
): Promise<Record<string, unknown>> {
  return operationResultSchema.parse(await invokePayoutAdmin(client, {
    action: 'operate_withdrawal',
    withdrawalId: z.string().uuid().parse(input.withdrawalId),
    decision: withdrawalOperationSchema.parse(input.operation),
    reasonCode: input.reasonCode ?? null,
    paymentReference: input.paymentReference ?? null,
    paymentEvidenceSha256: input.paymentEvidenceSha256 ?? null,
    requestId: input.requestId ?? crypto.randomUUID(),
  }));
}

export async function getKycReviewPayload(
  client: Client,
  input: { kycProfileId: string; requestId?: string },
): Promise<KycReviewPayload> {
  return kycReviewPayloadSchema.parse(await invokePayoutAdmin(client, {
    action: 'get_kyc_review',
    kycProfileId: z.string().uuid().parse(input.kycProfileId),
    requestId: input.requestId ?? crypto.randomUUID(),
  }));
}

export async function getBankReviewPayload(
  client: Client,
  input: { bankAccountId: string; requestId?: string },
): Promise<BankReviewPayload> {
  return bankReviewPayloadSchema.parse(await invokePayoutAdmin(client, {
    action: 'get_bank_review',
    bankAccountId: z.string().uuid().parse(input.bankAccountId),
    requestId: input.requestId ?? crypto.randomUUID(),
  }));
}

export async function getKycDocumentAccess(
  client: Client,
  input: { kycDocumentId: string; requestId?: string },
): Promise<KycDocumentAccess> {
  return kycDocumentAccessSchema.parse(await invokePayoutAdmin(client, {
    action: 'get_kyc_document_url',
    kycDocumentId: z.string().uuid().parse(input.kycDocumentId),
    requestId: input.requestId ?? crypto.randomUUID(),
  }));
}

export function payoutStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    not_submitted: 'Chưa gửi', pending: 'Chờ xử lý', under_review: 'Đang kiểm tra', approved: 'Đã duyệt',
    verified: 'Đã xác minh', rejected: 'Đã từ chối', processing: 'Đang chuyển tiền', paid: 'Đã thanh toán',
    cancelled: 'Đã hủy', reversed: 'Đã đảo giao dịch', disabled: 'Đã vô hiệu hóa', expired: 'Đã hết hạn', suspended: 'Tạm khóa',
  };
  return labels[status] ?? status;
}
