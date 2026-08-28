const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const HOUR_MS = 60 * 60_000;

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function vietnamDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return { day: part('day'), month: part('month'), year: part('year') };
}

function sameVietnamCalendarDay(left: Date, right: Date): boolean {
  const a = vietnamDateParts(left);
  const b = vietnamDateParts(right);
  return a.day === b.day && a.month === b.month && a.year === b.year;
}

function formatVietnamDate(date: Date): string {
  const { day, month, year } = vietnamDateParts(date);
  return `${day}/${month}/${year}`;
}

export type MemberLastSignInInput = {
  lastSignInAt: string | null;
  lastActivityAt?: string | null;
  nowMs?: number;
};

export function formatMemberLastSignIn({
  lastSignInAt,
  lastActivityAt = null,
  nowMs = Date.now(),
}: MemberLastSignInInput): string {
  const signIn = parseTimestamp(lastSignInAt);
  if (!signIn) return 'Chưa có lịch sử đăng nhập';

  const activity = parseTimestamp(lastActivityAt);
  const mostRecentPresence = activity && activity.getTime() > signIn.getTime() ? activity : signIn;
  const presenceDiffMs = Math.max(0, nowMs - mostRecentPresence.getTime());

  // Chọn.Love product contract: a member who is active now, or who left less
  // than one hour ago, is presented simply as online. The recent-activity
  // timestamp is only used when the last-sign-in read model itself is visible,
  // so paid hide-online privacy remains authoritative.
  if (presenceDiffMs < HOUR_MS) return 'Đang online';

  const now = new Date(nowMs);
  if (sameVietnamCalendarDay(signIn, now)) {
    const elapsedHours = Math.max(1, Math.floor((nowMs - signIn.getTime()) / HOUR_MS));
    return `Đăng nhập cách ${elapsedHours} giờ`;
  }

  return `Đăng nhập ngày ${formatVietnamDate(signIn)}`;
}
