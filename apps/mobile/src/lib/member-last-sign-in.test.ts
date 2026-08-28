import { describe, expect, it } from 'vitest';
import { formatMemberLastSignIn } from './member-last-sign-in';

const now = Date.parse('2026-08-28T11:30:00+07:00');

describe('formatMemberLastSignIn', () => {
  it('shows online for activity within the last hour', () => {
    expect(formatMemberLastSignIn('2026-08-28T11:29:30+07:00', now)).toBe('Đang online');
    expect(formatMemberLastSignIn('2026-08-28T10:31:00+07:00', now)).toBe('Đang online');
  });

  it('shows elapsed hours after one hour when still on the same Vietnam calendar day', () => {
    expect(formatMemberLastSignIn('2026-08-28T10:30:00+07:00', now)).toBe('Đăng nhập cách 1 giờ');
    expect(formatMemberLastSignIn('2026-08-28T06:05:00+07:00', now)).toBe('Đăng nhập cách 5 giờ');
  });

  it('switches to the Vietnam calendar date on a previous day', () => {
    expect(formatMemberLastSignIn('2026-08-27T23:55:00+07:00', now)).toBe('Đăng nhập ngày 27/8/2026');
    expect(formatMemberLastSignIn('2026-08-26T18:00:00Z', now)).toBe('Đăng nhập ngày 27/8/2026');
  });

  it('does not invent activity when the server hides or lacks a timestamp', () => {
    expect(formatMemberLastSignIn(null, now)).toBe('Chưa có lịch sử đăng nhập');
    expect(formatMemberLastSignIn('not-a-date', now)).toBe('Chưa có lịch sử đăng nhập');
  });
});
