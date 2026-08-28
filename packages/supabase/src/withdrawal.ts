import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

const bankAccountSchema = z.object({
  id: z.string().uuid(),
  bank_code: z.string(),
  account_number_last4: z.string(),
  status: z.string(),
  is_default: z.boolean(),
  verified_at: z.string().nullable(),
  rejection_reason_code: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const withdrawalSchema = z.object({
  id: z.string().uuid(),
  bank_account_id: z.string().uuid(),
  bank_code_snapshot: z.string(),
  bank_account_last4_snapshot: z.string(),
  requested_reward_units: z.coerce.number().int().positive(),
  amount_vnd: z.coerce.number().int().nonnegative(),
  heart_vnd_rate_snapshot: z.coerce.number().int().positive(),
  status: z.string(),
  requested_at: z.string(),
  reviewed_at: z.string().nullable(),
  rejection_reason_code: z.string().nullable(),
  approved_at: z.string().nullable(),
  paid_at: z.string().nullable(),
  payment_reference: z.string().nullable(),
  created_at: z.string(),
});

const requestResultSchema = z.object({
  withdrawal_id: z.string().uuid(),
  status: z.string(),
  requested_reward_units: z.coerce.number().int().positive(),
  amount_vnd: z.coerce.number().int().nonnegative(),
  held_balance_units: z.coerce.number().int().nonnegative(),
  already_processed: z.boolean(),
});

const cancelResultSchema = z.object({
  withdrawal_id: z.string().uuid(),
  status: z.string(),
  available_balance_units: z.coerce.number().int().nonnegative(),
  already_processed: z.boolean(),
});

const bankSubmitResultSchema = z.object({
  bank_account_id: z.string().uuid(),
  status: z.string(),
  bank_code: z.string(),
  account_number_last4: z.string(),
  is_default: z.boolean(),
  already_processed: z.boolean(),
  requestId: z.string().uuid(),
});

const edgeErrorSchema = z.object({ error: z.string().min(1) });

export type MyPayoutBankAccount = z.infer<typeof bankAccountSchema>;
export type MyWithdrawal = z.infer<typeof withdrawalSchema>;
export type RequestWithdrawalResult = z.infer<typeof requestResultSchema>;
export type CancelWithdrawalResult = z.infer<typeof cancelResultSchema>;
export type SubmitBankAccountResult = z.infer<typeof bankSubmitResultSchema>;

type Client = SupabaseClient<Database>;

export const withdrawalQueryKeys = {
  all: (userId: string | null) => ['withdrawal', userId] as const,
  banks: (userId: string | null) => ['withdrawal', userId, 'banks'] as const,
  history: (userId: string | null) => ['withdrawal', userId, 'history'] as const,
};

export async function listMyPayoutBankAccounts(client: Client): Promise<MyPayoutBankAccount[]> {
  const { data, error } = await client.rpc('list_my_bank_accounts' as never);
  if (error) throw error;
  return z.array(bankAccountSchema).parse(data);
}

export async function listMyWithdrawals(client: Client, limit = 50): Promise<MyWithdrawal[]> {
  const { data, error } = await client.rpc('list_my_withdrawals' as never, {
    p_limit: limit,
    p_cursor: null,
  } as never);
  if (error) throw error;
  return z.array(withdrawalSchema).parse(data);
}

export async function requestMyWithdrawal(
  client: Client,
  input: { bankAccountId: string; requestedRewardUnits: number; idempotencyKey: string },
): Promise<RequestWithdrawalResult> {
  const bankAccountId = z.string().uuid().parse(input.bankAccountId);
  const requestedRewardUnits = z.number().int().positive().parse(input.requestedRewardUnits);
  const idempotencyKey = z.string().uuid().parse(input.idempotencyKey);
  const { data, error } = await client.rpc('request_withdrawal' as never, {
    p_bank_account_id: bankAccountId,
    p_requested_reward_units: requestedRewardUnits,
    p_idempotency_key: idempotencyKey,
  } as never);
  if (error) throw error;
  return requestResultSchema.parse(Array.isArray(data) ? data[0] : data);
}

export async function cancelMyWithdrawal(
  client: Client,
  input: { withdrawalId: string; requestId: string },
): Promise<CancelWithdrawalResult> {
  const { data, error } = await client.rpc('cancel_my_withdrawal' as never, {
    p_withdrawal_id: z.string().uuid().parse(input.withdrawalId),
    p_request_id: z.string().uuid().parse(input.requestId),
  } as never);
  if (error) throw error;
  return cancelResultSchema.parse(Array.isArray(data) ? data[0] : data);
}

export async function submitMyPayoutBankAccount(
  client: Client,
  input: {
    bankCode: string;
    accountNumber: string;
    accountHolder: string;
    isDefault?: boolean;
    requestId: string;
  },
): Promise<SubmitBankAccountResult> {
  const body = {
    action: 'upsert_bank',
    bankAccountId: null,
    bankCode: input.bankCode.trim().toUpperCase(),
    accountNumber: input.accountNumber.replace(/\s+/gu, ''),
    accountHolder: input.accountHolder.trim(),
    isDefault: input.isDefault ?? true,
    requestId: z.string().uuid().parse(input.requestId),
  };
  const { data, error } = await client.functions.invoke('payout-profile-submit', { body });
  if (error) {
    const parsed = edgeErrorSchema.safeParse(data);
    throw new Error(parsed.success ? parsed.data.error : error.message);
  }
  const parsedError = edgeErrorSchema.safeParse(data);
  if (parsedError.success) throw new Error(parsedError.data.error);
  return bankSubmitResultSchema.parse(data);
}

export function withdrawalStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Chờ xử lý',
    under_review: 'Đang kiểm tra',
    approved: 'Đã duyệt',
    processing: 'Đang chuyển tiền',
    paid: 'Đã thanh toán',
    rejected: 'Đã từ chối',
    cancelled: 'Đã hủy',
    reversed: 'Đã hoàn lại',
  };
  return labels[status] ?? status;
}
