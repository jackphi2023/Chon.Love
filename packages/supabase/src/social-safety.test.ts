import { describe, expect, it } from 'vitest';
import {
  formatHeartUnits,
  getReadableSocialError,
  getRelationshipActionLabel,
  REPORT_REASON_OPTIONS,
} from './social-safety';

describe('social safety helpers', () => {
  it('keeps the report reason contract explicit and unique', () => {
    expect(REPORT_REASON_OPTIONS.map((item) => item.code)).toEqual([
      'spam',
      'harassment',
      'impersonation',
      'sexual_content',
      'underage',
      'scam',
      'violence',
      'other',
    ]);
    expect(new Set(REPORT_REASON_OPTIONS.map((item) => item.code)).size).toBe(REPORT_REASON_OPTIONS.length);
  });

  it('formats integer heart units without floating-point money', () => {
    expect(formatHeartUnits(0)).toBe('0');
    expect(formatHeartUnits(100)).toBe('1');
    expect(formatHeartUnits(150)).toBe('1,5');
    expect(formatHeartUnits(1000)).toBe('10');
  });

  it('maps relationship state to a single safe action', () => {
    expect(getRelationshipActionLabel({ friendship_status: 'none', friendship_direction: 'none' })).toBe('Kết bạn');
    expect(getRelationshipActionLabel({ friendship_status: 'pending', friendship_direction: 'incoming' })).toBe('Phản hồi lời mời');
    expect(getRelationshipActionLabel({ friendship_status: 'pending', friendship_direction: 'outgoing' })).toBe('Hủy lời mời');
    expect(getRelationshipActionLabel({ friendship_status: 'accepted', friendship_direction: 'mutual' })).toBe('Bạn bè');
    expect(getRelationshipActionLabel({ friendship_status: 'blocked', friendship_direction: 'outgoing_block' })).toBe('Bỏ chặn');
  });

  it('does not expose raw server errors to users', () => {
    expect(getReadableSocialError(new Error('report_rate_limited'))).toContain('một phút');
    expect(getReadableSocialError(new Error('sensitive_internal_detail'))).toBe('Không thể hoàn tất thao tác. Hãy thử lại.');
  });
});
