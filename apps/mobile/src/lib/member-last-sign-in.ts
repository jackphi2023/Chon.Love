const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function formatVietnamDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('hour')}:${part('minute')} · ${part('day')}/${part('month')}/${part('year')}`;
}

export function formatMemberLastSignIn(value: string | null, nowMs = Date.now()): string {
  if (!value) return 'Chưa có lịch sử đăng nhập';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có lịch sử đăng nhập';

  const diffMs = Math.max(0, nowMs - date.getTime());
  if (diffMs < MINUTE_MS) return 'Vừa đăng nhập';
  if (diffMs < HOUR_MS) return `Đăng nhập ${Math.max(1, Math.floor(diffMs / MINUTE_MS))} phút trước`;
  if (diffMs < DAY_MS) return `Đăng nhập ${Math.max(1, Math.floor(diffMs / HOUR_MS))} giờ trước`;
  return `Đăng nhập ${formatVietnamDateTime(date)}`;
}
