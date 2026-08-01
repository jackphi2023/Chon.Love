import { describe, expect, it } from 'vitest';
import {
  getVietqrReconciliationStatusLabel,
  vietqrReconciliationDecisionSchema,
  vietqrReconciliationStatusSchema,
} from './vietqr-reconciliation';

describe('VietQR reconciliation client contract', () => {
  it('accepts every reconciliation state', () => {
    expect(vietqrReconciliationStatusSchema.options).toEqual([
      'unmatched',
      'matched',
      'needs_review',
      'settled',
      'ignored',
      'rejected',
    ]);
  });

  it('accepts only audited finance decisions', () => {
    expect(vietqrReconciliationDecisionSchema.parse('match')).toBe('match');
    expect(vietqrReconciliationDecisionSchema.parse('settle')).toBe('settle');
    expect(vietqrReconciliationDecisionSchema.parse('ignore')).toBe('ignore');
    expect(vietqrReconciliationDecisionSchema.parse('reject')).toBe('reject');
    expect(() => vietqrReconciliationDecisionSchema.parse('auto_settle')).toThrow();
  });

  it('maps each state to a Vietnamese operations label', () => {
    expect(getVietqrReconciliationStatusLabel('unmatched')).toBe('Chưa khớp');
    expect(getVietqrReconciliationStatusLabel('matched')).toBe('Đã khớp');
    expect(getVietqrReconciliationStatusLabel('needs_review')).toBe('Cần kiểm tra');
    expect(getVietqrReconciliationStatusLabel('settled')).toBe('Đã ghi có');
    expect(getVietqrReconciliationStatusLabel('ignored')).toBe('Đã bỏ qua');
    expect(getVietqrReconciliationStatusLabel('rejected')).toBe('Đã từ chối');
  });
});
