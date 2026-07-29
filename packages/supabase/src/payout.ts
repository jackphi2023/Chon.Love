import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from './database.types';
import type { RealtimeRowChange } from './social';

export type PayoutSync = Tables<'payout_sync'>;
export type KycStatusSummary = Database['public']['Functions']['get_my_kyc_status']['Returns'][number];
export type BankAccountSummary = Database['public']['Functions']['list_my_bank_accounts']['Returns'][number];
export type PayoutSummary = Database['public']['Functions']['get_my_payout_summary']['Returns'][number];
export type WithdrawalSummary = Database['public']['Functions']['list_my_withdrawals']['Returns'][number];
export type WithdrawalRequestResult = Database['public']['Functions']['request_withdrawal']['Returns'][number];
export type WithdrawalCancellationResult = Database['public']['Functions']['cancel_my_withdrawal']['Returns'][number];
export type AccountDeletionStatus = Database['public']['Functions']['get_my_account_deletion_status']['Returns'][number];
export type PreparedKycDocumentUpload = Database['public']['Functions']['prepare_kyc_document_upload']['Returns'][number];
export type FinalizedKycDocumentUpload = Database['public']['Functions']['finalize_kyc_document_upload']['Returns'][number];

export type KycDocumentSide = 'front' | 'back' | 'portrait' | 'supplemental';
export type KycDocumentType = 'national_id' | 'passport' | 'drivers_license' | 'residence_permit' | 'other';
export type KycMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
export type KycExtension = 'jpg' | 'jpeg' | 'png' | 'webp' | 'pdf';

export type PrepareKycDocumentUploadInput = {
  mimeType: KycMimeType;
  fileSizeBytes: number;
  documentSide: KycDocumentSide;
  width?: number | null;
  height?: number | null;
  sha256?: string | null;
  extension: KycExtension;
};

export type UploadKycDocumentInput = PrepareKycDocumentUploadInput & {
  data: ArrayBuffer;
  cacheControlSeconds?: number;
};

export type KycDocumentUploadResult = {
  prepared: PreparedKycDocumentUpload;
  finalized: FinalizedKycDocumentUpload;
};

export type SubmitKycProfileInput = {
  legalName: string;
  documentType: KycDocumentType;
  documentNumber: string;
  countryCode: string;
  documentIds: string[];
  requestId?: string;
};

export type SubmitKycProfileResult = {
  kyc_profile_id: string;
  status: string;
  submitted_at: string;
  already_processed: boolean;
  requestId: string;
};

export type UpsertBankAccountInput = {
  bankAccountId?: string | null;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  isDefault?: boolean;
  requestId?: string;
};

export type UpsertBankAccountResult = {
  bank_account_id: string;
  status: string;
  bank_code: string;
  account_number_last4: string;
  is_default: boolean;
  already_processed: boolean;
  requestId: string;
};

export type WithdrawalPageInput = {
  limit?: number;
  cursor?: string | null;
};

export type RequestWithdrawalInput = {
  bankAccountId: string;
  requestedRewardUnits: number;
  requestId: string;
};

export type CancelWithdrawalInput = {
  withdrawalId: string;
  requestId: string;
};

export type RequestAccountDeletionInput = {
  reason?: string | null;
  requestId?: string;
};

export type CancelAccountDeletionInput = {
  deletionRequestId: string;
  requestId?: string;
};

export type AccountDeletionActionResult = {
  deletion_request_id: string;
  status: string;
  scheduled_delete_at?: string;
  legal_hold?: boolean;
  already_processed: boolean;
  requestId: string;
  refreshSessionsRevoked?: boolean;
  accessTokenExpiresNormally?: boolean;
};

function firstOrThrow<T>(rows: T[] | null, operation: string): T {
  const row = rows?.[0];
  if (!row) throw new Error(`${operation} returned no row.`);
  return row;
}

function boundedPageSize(limit = 50): number {
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function assertPositiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive safe integer.`);
  return value;
}

export async function prepareKycDocumentUpload(
  client: SupabaseClient<Database>,
  input: PrepareKycDocumentUploadInput,
): Promise<PreparedKycDocumentUpload> {
  const fileSizeBytes = assertPositiveSafeInteger(input.fileSizeBytes, 'KYC file size');
  const { data, error } = await client.rpc('prepare_kyc_document_upload', {
    p_mime_type: input.mimeType,
    p_file_size_bytes: fileSizeBytes,
    p_document_side: input.documentSide,
    p_extension: input.extension,
    ...(input.width == null ? {} : { p_width: input.width }),
    ...(input.height == null ? {} : { p_height: input.height }),
    ...(input.sha256 == null ? {} : { p_sha256: input.sha256 }),
  });
  if (error) throw error;
  return firstOrThrow(data, 'prepare_kyc_document_upload');
}

export async function uploadPreparedKycDocument(
  client: SupabaseClient<Database>,
  prepared: PreparedKycDocumentUpload,
  input: UploadKycDocumentInput,
): Promise<FinalizedKycDocumentUpload> {
  if (input.data.byteLength !== input.fileSizeBytes) throw new Error('KYC document byte length does not match declared file size.');
  const { error: uploadError } = await client.storage.from(prepared.storage_bucket).upload(prepared.storage_path, input.data, {
    contentType: input.mimeType,
    cacheControl: String(input.cacheControlSeconds ?? 0),
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const { data, error } = await client.rpc('finalize_kyc_document_upload', {
    p_media_id: prepared.media_id,
    p_document_side: input.documentSide,
  });
  if (error) throw error;
  return firstOrThrow(data, 'finalize_kyc_document_upload');
}

export async function uploadKycDocument(
  client: SupabaseClient<Database>,
  input: UploadKycDocumentInput,
): Promise<KycDocumentUploadResult> {
  const prepared = await prepareKycDocumentUpload(client, input);
  const finalized = await uploadPreparedKycDocument(client, prepared, input);
  return { prepared, finalized };
}

export async function submitKycProfile(
  client: SupabaseClient<Database>,
  input: SubmitKycProfileInput,
): Promise<SubmitKycProfileResult> {
  const { data, error } = await client.functions.invoke<SubmitKycProfileResult>('payout-profile-submit', {
    body: {
      action: 'submit_kyc',
      legalName: input.legalName,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      countryCode: input.countryCode,
      documentIds: input.documentIds,
      ...(input.requestId ? { requestId: input.requestId } : {}),
    },
  });
  if (error) throw error;
  if (!data?.kyc_profile_id) throw new Error('payout-profile-submit returned no KYC result.');
  return data;
}

export async function upsertBankAccount(
  client: SupabaseClient<Database>,
  input: UpsertBankAccountInput,
): Promise<UpsertBankAccountResult> {
  const { data, error } = await client.functions.invoke<UpsertBankAccountResult>('payout-profile-submit', {
    body: {
      action: 'upsert_bank',
      ...(input.bankAccountId == null ? {} : { bankAccountId: input.bankAccountId }),
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
      accountHolder: input.accountHolder,
      isDefault: input.isDefault ?? false,
      ...(input.requestId ? { requestId: input.requestId } : {}),
    },
  });
  if (error) throw error;
  if (!data?.bank_account_id) throw new Error('payout-profile-submit returned no bank account result.');
  return data;
}

export async function getMyKycStatus(client: SupabaseClient<Database>): Promise<KycStatusSummary | null> {
  const { data, error } = await client.rpc('get_my_kyc_status');
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function listMyBankAccounts(client: SupabaseClient<Database>): Promise<BankAccountSummary[]> {
  const { data, error } = await client.rpc('list_my_bank_accounts');
  if (error) throw error;
  return data ?? [];
}

export async function getMyPayoutSummary(client: SupabaseClient<Database>): Promise<PayoutSummary | null> {
  const { data, error } = await client.rpc('get_my_payout_summary');
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function listMyWithdrawals(
  client: SupabaseClient<Database>,
  input: WithdrawalPageInput = {},
): Promise<WithdrawalSummary[]> {
  const { data, error } = await client.rpc('list_my_withdrawals', {
    p_limit: boundedPageSize(input.limit),
    ...(input.cursor == null ? {} : { p_cursor: input.cursor }),
  });
  if (error) throw error;
  return data ?? [];
}

export async function requestWithdrawal(
  client: SupabaseClient<Database>,
  input: RequestWithdrawalInput,
): Promise<WithdrawalRequestResult> {
  const { data, error } = await client.rpc('request_withdrawal', {
    p_bank_account_id: input.bankAccountId,
    p_requested_reward_units: assertPositiveSafeInteger(input.requestedRewardUnits, 'Requested reward units'),
    p_idempotency_key: input.requestId,
  });
  if (error) throw error;
  return firstOrThrow(data, 'request_withdrawal');
}

export async function cancelMyWithdrawal(
  client: SupabaseClient<Database>,
  input: CancelWithdrawalInput,
): Promise<WithdrawalCancellationResult> {
  const { data, error } = await client.rpc('cancel_my_withdrawal', {
    p_withdrawal_id: input.withdrawalId,
    p_request_id: input.requestId,
  });
  if (error) throw error;
  return firstOrThrow(data, 'cancel_my_withdrawal');
}

export async function getMyAccountDeletionStatus(client: SupabaseClient<Database>): Promise<AccountDeletionStatus | null> {
  const { data, error } = await client.rpc('get_my_account_deletion_status');
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function requestAccountDeletion(
  client: SupabaseClient<Database>,
  input: RequestAccountDeletionInput = {},
): Promise<AccountDeletionActionResult> {
  const { data, error } = await client.functions.invoke<AccountDeletionActionResult>('account-deletion', {
    body: {
      action: 'request',
      ...(input.reason == null ? {} : { reason: input.reason }),
      ...(input.requestId ? { requestId: input.requestId } : {}),
    },
  });
  if (error) throw error;
  if (!data?.deletion_request_id) throw new Error('account-deletion returned no request result.');
  return data;
}

export async function cancelAccountDeletion(
  client: SupabaseClient<Database>,
  input: CancelAccountDeletionInput,
): Promise<AccountDeletionActionResult> {
  const { data, error } = await client.functions.invoke<AccountDeletionActionResult>('account-deletion', {
    body: {
      action: 'cancel',
      deletionRequestId: input.deletionRequestId,
      ...(input.requestId ? { requestId: input.requestId } : {}),
    },
  });
  if (error) throw error;
  if (!data?.deletion_request_id) throw new Error('account-deletion returned no cancellation result.');
  return data;
}

export function subscribeToPayoutSync(
  client: SupabaseClient<Database>,
  userId: string,
  onChange: (change: RealtimeRowChange<PayoutSync>) => void,
): RealtimeChannel {
  return client
    .channel(`payout:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'payout_sync', filter: `user_id=eq.${userId}` },
      (payload) => onChange(payload as unknown as RealtimeRowChange<PayoutSync>),
    )
    .subscribe();
}
