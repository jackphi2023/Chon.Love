import { describe, expect, it } from 'vitest';
import {
  bankDecisionSchema,
  kycDecisionSchema,
  payoutQueueKindSchema,
  withdrawalNextStepLabel,
  withdrawalOperationSchema,
  withdrawalOperationsForStatus,
  withdrawalQueueItemSchema,
} from './kyc-withdrawal-operations';

describe('BR-08 / OPT-13 KYC and withdrawal operational contract', () => {
  it('accepts only supported queue kinds and decisions', () => {
    expect(payoutQueueKindSchema.parse('withdrawal')).toBe('withdrawal');
    expect(kycDecisionSchema.parse('approve')).toBe('approve');
    expect(bankDecisionSchema.parse('verify')).toBe('verify');
    expect(withdrawalOperationSchema.parse('mark_paid')).toBe('mark_paid');
    expect(() => withdrawalOperationSchema.parse('auto_pay')).toThrow();
  });

  it('requires dual-control and evidence fields in the queue contract', () => {
    const row = withdrawalQueueItemSchema.parse({
      withdrawal_id: crypto.randomUUID(), creator_id: crypto.randomUUID(), display_name: 'Member', status: 'processing',
      requested_reward_units: 1000, amount_vnd: 500000, bank_code: 'VCB', bank_last4: '1234',
      requested_at: new Date().toISOString(), assigned_to: crypto.randomUUID(), review_started_at: new Date().toISOString(),
      review_due_at: new Date().toISOString(), approved_by: crypto.randomUUID(), processing_started_by: crypto.randomUUID(),
      payment_recorded_by: null, payment_reference: null, payment_evidence_present: false, age_minutes: 5, total_count: 1,
    });
    expect(row.payment_evidence_present).toBe(false);
    expect(row.approved_by).not.toBe(row.processing_started_by);
  });

  it('exposes only legal withdrawal actions for each admin state', () => {
    expect(withdrawalOperationsForStatus('pending')).toEqual([]);
    expect(withdrawalOperationsForStatus('under_review')).toEqual(['approve', 'reject']);
    expect(withdrawalOperationsForStatus('approved')).toEqual(['start_processing', 'reject']);
    expect(withdrawalOperationsForStatus('processing')).toEqual(['mark_paid']);
    for (const terminal of ['paid', 'rejected', 'cancelled', 'reversed']) {
      expect(withdrawalOperationsForStatus(terminal)).toEqual([]);
    }
  });

  it('documents the maker-checker handoff in the next-step labels', () => {
    expect(withdrawalNextStepLabel('approved')).toContain('finance operator khác');
    expect(withdrawalNextStepLabel('processing')).toContain('chứng từ');
    expect(withdrawalNextStepLabel('paid')).toContain('hoàn tất');
  });
});
