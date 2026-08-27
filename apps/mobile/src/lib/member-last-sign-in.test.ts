import { describe, expect, it } from 'vitest';
import { formatMemberLastSignIn } from './member-last-sign-in';

const now = Date.parse('2026-08-28T02:00:00+07:00');

describe('formatMemberLastSignIn', () => {
  it('uses relative copy only inside the first 24 hours', () => {
    expect(formatMemberLastSignIn('2026-08-28T01:59:30+07:00', now)).toBe('Vừa đăng nhập');
    expect(formatMemberLastSignIn('2026-08-28T01:42:00+07:00', now)).toBe('Đăng nhập 18 phút trước');
    expect(formatMemberLastSignIn('2026-08-27T21:00:00+07:00', now)).toBe('Đăng nhập 5 giờ trước');
  });

  it('uses an exact Vietnam date and time at 24 hours or older', () => {
    expect(formatMemberLastSignIn('2026-08-27T01:15:00+07:00', now)).toBe('Đăng nhập 01:15 · 27/08/2026');
  });

  it('does not invent activity when the server hides or lacks a login timestamp', () => {
    expect(formatMemberLastSignIn(null, now)).toBe('Chưa có lịch sử đăng nhập');
    expect(formatMemberLastSignIn('not-a-date', now)).toBe('Chưa có lịch sử đăng nhập');
  });
});
