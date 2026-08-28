import { describe, expect, it } from 'vitest';
import { formatMemberLastSignIn } from './member-last-sign-in';

const now = Date.parse('2026-08-28T11:30:00+07:00');

describe('formatMemberLastSignIn', () => {
  it('shows online from explicit presence even when the auth login happened hours earlier', () => {
    expect(formatMemberLastSignIn('2026-08-28T06:00:00+07:00', {
      nowMs: now,
      status: 'online',
      lastActiveAt: '2026-08-28T11:20:00+07:00',
    })).toBe('Đang online');
  });

  it('keeps the member online for one hour after recent visible activity', () => {
    expect(formatMemberLastSignIn('2026-08-28T06:00:00+07:00', {
      nowMs: now,
      status: 'offline',
      lastActiveAt: '2026-08-28T10:31:00+07:00',
    })).toBe('Đang online');
  });

  it('shows elapsed hours from the true auth sign-in after recent presence expires on the same Vietnam day', () => {
    expect(formatMemberLastSignIn('2026-08-28T10:30:00+07:00', now)).toBe('Đăng nhập cách 1 giờ');
    expect(formatMemberLastSignIn('2026-08-28T06:05:00+07:00', {
      nowMs: now,
      status: 'offline',
      lastActiveAt: '2026-08-28T06:10:00+07:00',
    })).toBe('Đăng nhập cách 5 giờ');
  });

  it('switches to the Vietnam calendar date on a previous day', () => {
    expect(formatMemberLastSignIn('2026-08-27T23:55:00+07:00', now)).toBe('Đăng nhập ngày 27/8/2026');
    expect(formatMemberLastSignIn('2026-08-26T18:00:00Z', now)).toBe('Đăng nhập ngày 27/8/2026');
  });

  it('does not invent login history when the server hides or lacks the auth timestamp', () => {
    expect(formatMemberLastSignIn(null, now)).toBe('Chưa có lịch sử đăng nhập');
    expect(formatMemberLastSignIn('not-a-date', now)).toBe('Chưa có lịch sử đăng nhập');
  });
});
