'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAdminSupabaseClient } from '../../../src/lib/supabase';

type QueueItem = {
  case_id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  declared_gender: string;
  profile_status: string;
  case_status: string;
  priority: string;
  max_similarity: number | null;
  automated_score_json: Record<string, unknown>;
  created_at: string;
};

type Detail = {
  caseId: string;
  selfieUrl: string | null;
  referenceImages: Array<{ mediaId: string; signedUrl: string }>;
};

export function MemberVerificationAdmin() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const client = getAdminSupabaseClient();
    setBusy(true); setError(null);
    try {
      const { data, error: invokeError } = await client.functions.invoke('member-photo-verification', { body: { action: 'admin_list', limit: 100, offset: 0 } });
      if (invokeError) throw invokeError;
      setItems((data?.items ?? []) as QueueItem[]);
    } catch { setError('Không thể tải hàng chờ xác minh ảnh.'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function openDetail(item: QueueItem) {
    const client = getAdminSupabaseClient();
    setBusy(true); setError(null);
    try {
      const { data, error: invokeError } = await client.functions.invoke('member-photo-verification', { body: { action: 'admin_detail', caseId: item.case_id } });
      if (invokeError) throw invokeError;
      setDetail({ caseId: item.case_id, selfieUrl: data?.selfieUrl ?? null, referenceImages: data?.referenceImages ?? [] });
    } catch { setError('Không thể tạo link ảnh review.'); }
    finally { setBusy(false); }
  }

  async function review(caseId: string, decision: 'approve' | 'hide') {
    const label = decision === 'approve' ? 'duyệt kích hoạt' : 'ẩn/vô hiệu';
    if (!window.confirm(`Xác nhận ${label} tài khoản này?`)) return;
    const reason = window.prompt('Lý do review (khuyến nghị nhập để audit rõ ràng):', decision === 'approve' ? 'Ảnh selfie và ảnh hồ sơ cùng người.' : 'Ảnh không đủ căn cứ xác minh.') ?? '';
    const client = getAdminSupabaseClient();
    setBusy(true); setError(null);
    try {
      const { error: invokeError } = await client.functions.invoke('member-photo-verification', { body: { action: 'admin_review', caseId, decision, reason, requestId: crypto.randomUUID() } });
      if (invokeError) throw invokeError;
      setDetail(null);
      await load();
    } catch { setError('Không thể lưu quyết định review.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div><button disabled={busy} onClick={() => void load()} type="button">{busy ? 'Đang xử lý…' : 'Tải lại hàng chờ'}</button></div>
      {error ? <p role="alert" style={{ color: '#b91c1c' }}>{error}</p> : null}
      {items.length === 0 && !busy ? <p>Không có tài khoản đang chờ review.</p> : null}
      {items.map((item) => {
        const reason = String(item.automated_score_json?.pendingReason ?? 'manual_review_required');
        return (
          <article key={item.case_id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <strong>{item.display_name || item.username || item.user_id}</strong>
            <div style={{ marginTop: 8, display: 'grid', gap: 4, fontSize: 14 }}>
              <span>User: {item.username || item.user_id}</span>
              <span>Giới tính khai báo: {item.declared_gender}</span>
              <span>Face similarity: {item.max_similarity == null ? 'N/A' : `${Number(item.max_similarity).toFixed(1)}%`} / ngưỡng 60%</span>
              <span>Lý do pending: {reason}</span>
              <span>Tạo lúc: {new Date(item.created_at).toLocaleString('vi-VN')}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button disabled={busy} onClick={() => void openDetail(item)} type="button">Xem selfie + ảnh upload</button>
              <button disabled={busy} onClick={() => void review(item.case_id, 'approve')} type="button">Duyệt & kích hoạt</button>
              <button disabled={busy} onClick={() => void review(item.case_id, 'hide')} type="button">Ẩn / vô hiệu</button>
            </div>
          </article>
        );
      })}

      {detail ? (
        <section style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
          <h2>So sánh trực quan</h2>
          <p>Link ảnh chỉ có hiệu lực 60 giây.</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {detail.selfieUrl ? <figure style={{ margin: 0 }}><figcaption>Selfie live</figcaption><img alt="Selfie live" src={detail.selfieUrl} style={{ borderRadius: 12, height: 300, objectFit: 'cover', width: 240 }} /></figure> : null}
            {detail.referenceImages.map((image, index) => <figure key={image.mediaId} style={{ margin: 0 }}><figcaption>Ảnh upload #{index + 1}</figcaption><img alt={`Ảnh upload ${index + 1}`} src={image.signedUrl} style={{ borderRadius: 12, height: 300, objectFit: 'cover', width: 240 }} /></figure>)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
