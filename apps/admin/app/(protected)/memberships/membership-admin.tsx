'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAdminSupabaseClient } from '../../../src/lib/supabase';

type QueueItem = {
  order_id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  tier: 'premium' | 'diamond';
  period_count: 1 | 3;
  amount_due_vnd: number;
  heart_credit_units: number;
  order_code: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  total_count: number;
};

type QueueStatus = 'awaiting_confirmation' | 'approved' | 'rejected' | 'cancelled';

function money(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
}

function hearts(units: number) {
  return `${new Intl.NumberFormat('vi-VN').format(units / 100)} ❤️`;
}

export function MembershipAdmin() {
  const [status, setStatus] = useState<QueueStatus>('awaiting_confirmation');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const client = getAdminSupabaseClient();
    if (!client) { setError('Supabase Admin chưa được cấu hình.'); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: invokeError } = await client.functions.invoke('membership-admin', {
        body: { action: 'list', status, limit: 100, offset: 0 },
      });
      if (invokeError) throw invokeError;
      setItems((data?.items ?? []) as QueueItem[]);
    } catch {
      setError('Không thể tải hàng chờ gói thành viên.');
    } finally { setLoading(false); }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const total = useMemo(() => items[0]?.total_count ?? items.length, [items]);

  async function approve(item: QueueItem) {
    const bankRef = window.prompt(`Mã giao dịch ngân hàng cho ${item.order_code}:`, '')?.trim() ?? '';
    if (!bankRef) return;
    const amountInput = window.prompt('Số tiền thực nhận (VND):', String(item.amount_due_vnd))?.trim() ?? '';
    if (!/^\d+$/u.test(amountInput)) return;
    const paidAmount = Number(amountInput);
    if (paidAmount !== item.amount_due_vnd) {
      window.alert(`Số tiền phải khớp chính xác ${money(item.amount_due_vnd)}. Không kích hoạt gói khi thiếu/thừa.`);
      return;
    }
    if (!window.confirm(`Xác nhận ${item.tier.toUpperCase()} ${item.period_count} kỳ cho ${item.display_name || item.username || item.user_id}?`)) return;
    const client = getAdminSupabaseClient();
    if (!client) { setError('Supabase Admin chưa được cấu hình.'); return; }
    setBusyId(item.order_id); setError(null);
    try {
      const { error: invokeError } = await client.functions.invoke('membership-admin', {
        body: {
          action: 'approve',
          orderId: item.order_id,
          bankTransactionRef: bankRef,
          paidAmountVnd: paidAmount,
          requestId: crypto.randomUUID(),
        },
      });
      if (invokeError) throw invokeError;
      await load();
    } catch {
      setError('Không thể duyệt gói. Kiểm tra quyền Admin, mã giao dịch và số tiền thực nhận.');
    } finally { setBusyId(null); }
  }

  async function reject(item: QueueItem) {
    const reason = window.prompt('Reason code để audit (ví dụ payment_not_found):', 'payment_not_found')?.trim().toLowerCase() ?? '';
    if (!/^[a-z][a-z0-9_]{1,63}$/u.test(reason)) return;
    if (!window.confirm(`Từ chối yêu cầu ${item.order_code}?`)) return;
    const client = getAdminSupabaseClient();
    if (!client) { setError('Supabase Admin chưa được cấu hình.'); return; }
    setBusyId(item.order_id); setError(null);
    try {
      const { error: invokeError } = await client.functions.invoke('membership-admin', {
        body: { action: 'reject', orderId: item.order_id, reasonCode: reason, requestId: crypto.randomUUID() },
      });
      if (invokeError) throw invokeError;
      await load();
    } catch {
      setError('Không thể từ chối yêu cầu gói thành viên.');
    } finally { setBusyId(null); }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label htmlFor="membership-status"><strong>Trạng thái</strong></label>
        <select id="membership-status" onChange={(event) => setStatus(event.target.value as QueueStatus)} value={status}>
          <option value="awaiting_confirmation">Chờ xác nhận</option>
          <option value="approved">Đã duyệt</option>
          <option value="rejected">Đã từ chối</option>
          <option value="cancelled">Đã hủy</option>
        </select>
        <button disabled={loading} onClick={() => void load()} type="button">{loading ? 'Đang tải…' : 'Tải lại'}</button>
        <span>{total} yêu cầu</span>
      </div>
      {error ? <p role="alert" style={{ color: '#b91c1c' }}>{error}</p> : null}
      {!loading && items.length === 0 ? <p>Không có yêu cầu trong trạng thái này.</p> : null}
      {items.map((item) => (
        <article key={item.order_id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <strong>{item.display_name || item.username || item.user_id}</strong>
              <div style={{ marginTop: 8, display: 'grid', gap: 4, fontSize: 14 }}>
                <span>Mã: {item.order_code}</span>
                <span>Gói: {item.tier === 'diamond' ? 'Kim cương / Diamond' : 'Cao cấp / Premium'} · {item.period_count} kỳ</span>
                <span>Phải thu: <strong>{money(item.amount_due_vnd)}</strong></span>
                <span>❤️ sau duyệt: {item.tier === 'diamond' ? hearts(item.heart_credit_units) : 'Không có'}</span>
                <span>Gửi đối soát: {item.submitted_at ? new Date(item.submitted_at).toLocaleString('vi-VN') : 'Chưa gửi'}</span>
              </div>
            </div>
            {item.status === 'awaiting_confirmation' ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <button disabled={busyId !== null} onClick={() => void approve(item)} type="button">Duyệt & kích hoạt</button>
                <button disabled={busyId !== null} onClick={() => void reject(item)} type="button">Từ chối</button>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
