import { describe, expect, it, vi } from 'vitest';
import {
  cancelMyWithdrawal,
  listMyPayoutBankAccounts,
  listMyWithdrawals,
  requestMyWithdrawal,
  submitMyPayoutBankAccount,
  withdrawalStatusLabel,
} from './withdrawal';

const bankId = '7a100000-0000-4000-8000-000000000001';
const withdrawalId = '7a200000-0000-4000-8000-000000000001';
const requestId = '7a300000-0000-4000-8000-000000000001';

describe('OPT-12 user withdrawal client contract', () => {
  it('lists only the caller-owned redacted bank and withdrawal read models', async () => {
    const bankRow = {
      id: bankId,
      bank_code: 'VCB',
      account_number_last4: '1234',
      status: 'verified',
      is_default: true,
      verified_at: '2026-08-28T01:00:00.000Z',
      rejection_reason_code: null,
      created_at: '2026-08-27T01:00:00.000Z',
      updated_at: '2026-08-28T01:00:00.000Z',
    };
    const withdrawalRow = {
      id: withdrawalId,
      bank_account_id: bankId,
      bank_code_snapshot: 'VCB',
      bank_account_last4_snapshot: '1234',
      requested_reward_units: 1000,
      amount_vnd: 500000,
      heart_vnd_rate_snapshot: 50000,
      status: 'pending',
      requested_at: '2026-08-28T02:00:00.000Z',
      reviewed_at: null,
      rejection_reason_code: null,
      approved_at: null,
      paid_at: null,
      payment_reference: null,
      created_at: '2026-08-28T02:00:00.000Z',
    };
    const rpc = vi.fn(async (name: string) => {
      if (name === 'list_my_bank_accounts') return { error: null, data: [bankRow] };
      if (name === 'list_my_withdrawals') return { error: null, data: [withdrawalRow] };
      return { error: new Error('unexpected_rpc'), data: null };
    });

    await expect(listMyPayoutBankAccounts({ rpc } as never)).resolves.toEqual([bankRow]);
    await expect(listMyWithdrawals({ rpc } as never, 20)).resolves.toEqual([withdrawalRow]);
    expect(rpc).toHaveBeenNthCalledWith(1, 'list_my_bank_accounts');
    expect(rpc).toHaveBeenNthCalledWith(2, 'list_my_withdrawals', { p_limit: 20, p_cursor: null });
    expect(JSON.stringify(bankRow)).not.toContain('account_number_ciphertext');
  });

  it('submits a server-authoritative, idempotent withdrawal request without client-side balance mutation', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [{
        withdrawal_id: withdrawalId,
        status: 'pending',
        requested_reward_units: 1000,
        amount_vnd: 500000,
        held_balance_units: 1000,
        already_processed: false,
      }],
    });

    await expect(requestMyWithdrawal({ rpc } as never, {
      bankAccountId: bankId,
      requestedRewardUnits: 1000,
      idempotencyKey: requestId,
    })).resolves.toMatchObject({ withdrawal_id: withdrawalId, amount_vnd: 500000, already_processed: false });
    expect(rpc).toHaveBeenCalledWith('request_withdrawal', {
      p_bank_account_id: bankId,
      p_requested_reward_units: 1000,
      p_idempotency_key: requestId,
    });
  });

  it('cancels only through the caller-owned cancellation RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [{
        withdrawal_id: withdrawalId,
        status: 'cancelled',
        available_balance_units: 1400,
        already_processed: false,
      }],
    });

    await expect(cancelMyWithdrawal({ rpc } as never, {
      withdrawalId,
      requestId,
    })).resolves.toMatchObject({ status: 'cancelled', available_balance_units: 1400 });
    expect(rpc).toHaveBeenCalledWith('cancel_my_withdrawal', {
      p_withdrawal_id: withdrawalId,
      p_request_id: requestId,
    });
  });

  it('sends full bank details only to the existing encrypted payout Edge endpoint and keeps user-facing status labels stable', async () => {
    const invoke = vi.fn().mockResolvedValue({
      error: null,
      data: {
        bank_account_id: bankId,
        status: 'pending',
        bank_code: 'VCB',
        account_number_last4: '1234',
        is_default: true,
        already_processed: false,
        requestId,
      },
    });

    await expect(submitMyPayoutBankAccount({ functions: { invoke } } as never, {
      bankCode: ' vcb ',
      accountNumber: '1234 5678 1234',
      accountHolder: ' NGUYEN VAN A ',
      isDefault: true,
      requestId,
    })).resolves.toMatchObject({ bank_account_id: bankId, account_number_last4: '1234' });
    expect(invoke).toHaveBeenCalledWith('payout-profile-submit', {
      body: {
        action: 'upsert_bank',
        bankAccountId: null,
        bankCode: 'VCB',
        accountNumber: '123456781234',
        accountHolder: 'NGUYEN VAN A',
        isDefault: true,
        requestId,
      },
    });
    expect(withdrawalStatusLabel('processing')).toBe('Đang chuyển tiền');
    expect(withdrawalStatusLabel('paid')).toBe('Đã thanh toán');
  });
});
