const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const HOUR_MS = 60 * 60_000;

type MemberPresenceInput = {
  status?: 'online' | 'offline' | null | undefined;
  lastActiveAt?: string | null | undefined;
  nowMs?: number | undefined;
};

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

function resolveNowAndPresence(input: number | MemberPresenceInput | undefined) {
  if (typeof input === 'number') return { nowMs: input, status: null, lastActive: null };
  const nowMs = input?.nowMs ?? Date.now();
  return {
    nowMs,
    status: input?.status ?? null,
    lastActive: parseTimestamp(input?.lastActiveAt),
  };
}

export function formatMemberLastSignIn(
  value: string | null,
  nowOrPresence: number | MemberPresenceInput = Date.now(),
): string {
  const lastSignIn = parseTimestamp(value);
  const { nowMs, status, lastActive } = resolveNowAndPresence(nowOrPresence);

  // Presence is intentionally separate from Auth sign-in. A member is shown online
  // when the presence read model says so, or for one hour after the latest visible
  // activity signal. We never rewrite activity into the login timestamp itself.
  const recentActivityMs = lastActive ? Math.max(0, nowMs - lastActive.getTime()) : Number.POSITIVE_INFINITY;
  if (status === 'online' || recentActivityMs < HOUR_MS) return 'Đang online';

  if (!lastSignIn) return 'Chưa có lịch sử đăng nhập';

  const diffMs = Math.max(0, nowMs - lastSignIn.getTime());
  const now = new Date(nowMs);
  if (sameVietnamCalendarDay(lastSignIn, now)) {
    const elapsedHours = Math.max(1, Math.floor(diffMs / HOUR_MS));
    return `Đăng nhập cách ${elapsedHours} giờ`;
  }

  return `Đăng nhập ngày ${formatVietnamDate(lastSignIn)}`;
}
