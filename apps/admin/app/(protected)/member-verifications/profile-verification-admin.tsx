'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAdminSupabaseClient } from '../../../src/lib/supabase';

type QueueItem = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  identity_status: string;
  identity_submitted_at: string | null;
  linkedin_status: string;
  linkedin_profile_url: string | null;
  linkedin_submitted_at: string | null;
  updated_at: string;
};

type Detail = {
  item: QueueItem;
  identityFrontUrl: string | null;
  identityBackUrl: string | null;
  expiresInSeconds: number;
};

export function ProfileVerificationAdmin() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const client = getAdminSupabaseClient();
    if (!client) {
      setError('Supabase Admin chưa được cấu hình.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: invokeError } = await client.functions.invoke('member-profile-verification-admin', {
        body: { action: 'list', limit: 100, offset: 0 },
      });
      if (invokeError) throw invokeError;
      setItems((data?.items ?? []) as QueueItem[]);
    } catch {
      setError('Không thể tải hàng chờ CCCD / LinkedIn.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function openDetail(userId: string) {
    const client = getAdminSupabaseClient();
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: invokeError } = await client.functions.invoke('member-profile-verification-admin', {
        body: { action: 'detail', userId },
      });
      if (invokeError) throw invokeError;
      setDetail({
        item: data?.item as QueueItem,
        identityFrontUrl: data?.identityFrontUrl ?? null,
        identityBackUrl: data?.identityBackUrl ?? null,
        expiresInSeconds: Number(data?.expiresInSeconds ?? 60),
      });
    } catch {
      setError('Không thể mở chi tiết xác thực hồ sơ.');
    } finally {
      setBusy(false);
    }
  }

  async function review(item: QueueItem, kind: 'identity' | 'linkedin', decision: 'approve' | 'reject') {
    const label = kind === 'identity' ? 'CCCD' : 'LinkedIn';
    const actionLabel = decision === 'approve' ? 'duyệt' : 'từ chối';
    if (!window.confirm(`Xác nhận ${actionLabel} ${label} của ${item.display_name || item.username || item.user_id}?`)) return;
    const suggested = decision === 'approve' ? 'admin_verified' : kind === 'identity' ? 'identity_not_verified' : 'linkedin_not_verified';
    const reasonCode = window.prompt('Reason code cho audit:', suggested)?.trim() || suggested;
    const client = getAdminSupabaseClient();
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      const { error: invokeError } = await client.functions.invoke('member-profile-verification-admin', {
        body: {
          action: 'review',
          userId: item.user_id,
          kind,
          decision,
          reasonCode,
          requestId: crypto.randomUUID(),
        },
      });
      if (invokeError) throw invokeError;
      setDetail(null);
      await load();
    } catch {
      setError(`Không thể ${actionLabel} ${label}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <button disabled={busy} onClick={() => void load()} type="button">{busy ? 'Đang xử lý…' : 'Tải lại CCCD / LinkedIn'}</button>
      </div>
      {error ? <p role="alert" style={{ color: '#b91c1c' }}>{error}</p> : null}
      {items.length === 0 && !busy ? <p>Không có CCCD hoặc LinkedIn đang chờ review.</p> : null}

      {items.map((item) => (
        <article key={item.user_id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <strong>{item.display_name || item.username || item.user_id}</strong>
          <div style={{ display: 'grid', gap: 5, fontSize: 14, marginTop: 8 }}>
            <span>User: {item.username || item.user_id}</span>
            <span>CCCD: {statusLabel(item.identity_status)}{item.identity_submitted_at ? ` · ${new Date(item.identity_submitted_at).toLocaleString('vi-VN')}` : ''}</span>
            <span>LinkedIn: {statusLabel(item.linkedin_status)}{item.linkedin_profile_url ? ` · ${item.linkedin_profile_url}` : ''}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <button disabled={busy} onClick={() => void openDetail(item.user_id)} type="button">Xem chi tiết</button>
            {item.identity_status === 'pending' ? (
              <>
                <button disabled={busy} onClick={() => void review(item, 'identity', 'approve')} type="button">Duyệt CCCD</button>
                <button disabled={busy} onClick={() => void review(item, 'identity', 'reject')} type="button">Từ chối CCCD</button>
              </>
            ) : null}
            {item.linkedin_status === 'pending' ? (
              <>
                <button disabled={busy} onClick={() => void review(item, 'linkedin', 'approve')} type="button">Duyệt LinkedIn</button>
                <button disabled={busy} onClick={() => void review(item, 'linkedin', 'reject')} type="button">Từ chối LinkedIn</button>
              </>
            ) : null}
          </div>
        </article>
      ))}

      {detail ? (
        <section style={{ borderTop: '1px solid #e5e7eb', display: 'grid', gap: 12, paddingTop: 16 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Chi tiết xác thực hồ sơ</h2>
            <p style={{ marginTop: 0 }}>Ảnh CCCD là signed URL riêng tư và hết hạn sau {detail.expiresInSeconds} giây.</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {detail.identityFrontUrl ? (
              <figure style={{ margin: 0 }}>
                <figcaption>Mặt trước CCCD</figcaption>
                <img alt="Mặt trước CCCD" src={detail.identityFrontUrl} style={{ borderRadius: 12, height: 250, objectFit: 'contain', width: 390 }} />
              </figure>
            ) : null}
            {detail.identityBackUrl ? (
              <figure style={{ margin: 0 }}>
                <figcaption>Mặt sau CCCD</figcaption>
                <img alt="Mặt sau CCCD" src={detail.identityBackUrl} style={{ borderRadius: 12, height: 250, objectFit: 'contain', width: 390 }} />
              </figure>
            ) : null}
          </div>
          {detail.item.linkedin_profile_url ? (
            <p>LinkedIn: <a href={detail.item.linkedin_profile_url} rel="noreferrer" target="_blank">{detail.item.linkedin_profile_url}</a></p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function statusLabel(status: string): string {
  if (status === 'approved') return 'Đã duyệt';
  if (status === 'pending') return 'Đang chờ';
  if (status === 'rejected') return 'Đã từ chối';
  return 'Chưa gửi';
}
