'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAdminSupabaseClient } from '../../../src/lib/supabase';

type ReportItem = {
  report_id: string;
  reporter_id: string;
  reporter_username: string | null;
  reporter_display_name: string | null;
  target_user_id: string | null;
  target_username: string | null;
  target_display_name: string | null;
  target_media_id: string | null;
  target_message_id: string | null;
  reason_code: string;
  description: string | null;
  status: 'submitted' | 'triaged' | 'in_review' | 'resolved' | 'dismissed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assigned_to: string | null;
  resolution_code: string | null;
  created_at: string;
  updated_at: string;
  total_count: number;
};

type MediaStatus = 'pending_review' | 'approved' | 'rejected' | 'quarantined' | 'deleted';
type MediaAction = 'approve' | 'reject' | 'quarantine' | 'restore' | 'delete';

type MediaItem = {
  media_id: string;
  owner_id: string;
  owner_email: string | null;
  owner_username: string | null;
  owner_display_name: string | null;
  visibility: 'avatar' | 'public' | 'private';
  moderation_status: MediaStatus;
  moderation_reason_code: string | null;
  mime_type: string;
  created_at: string;
  updated_at: string;
  uploaded_at: string | null;
  preview_url: string | null;
  preview_expires_in_seconds: number;
  case_id: string | null;
  case_status: string | null;
  priority: string;
  rule_codes: string[];
  case_created_at: string | null;
  is_replacement: boolean;
  review_alert: string | null;
};

const mediaStatusLabels: Record<MediaStatus, string> = {
  pending_review: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
  quarantined: 'Cách ly',
  deleted: 'Đã xóa',
};

function mediaActions(status: MediaStatus): MediaAction[] {
  if (status === 'pending_review') return ['approve', 'reject', 'quarantine'];
  if (status === 'quarantined') return ['approve', 'reject', 'restore', 'delete'];
  if (status === 'approved') return ['quarantine', 'delete'];
  if (status === 'rejected') return ['restore', 'delete'];
  return [];
}

function mediaActionLabel(action: MediaAction): string {
  if (action === 'approve') return 'Duyệt';
  if (action === 'reject') return 'Từ chối';
  if (action === 'quarantine') return 'Cách ly';
  if (action === 'restore') return 'Đưa về chờ duyệt';
  return 'Xóa';
}

function defaultReasonCode(action: MediaAction): string {
  if (action === 'approve') return 'manual_review_approved';
  if (action === 'reject') return 'manual_review_rejected';
  if (action === 'quarantine') return 'manual_review_quarantined';
  if (action === 'restore') return 'manual_review_restored';
  return 'manual_review_deleted';
}

export function ModerationAdmin() {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaStatus, setMediaStatus] = useState<MediaStatus>('pending_review');
  const [mediaTotal, setMediaTotal] = useState(0);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    const client = getAdminSupabaseClient();
    if (!client) {
      setReportError('Supabase Admin chưa được cấu hình.');
      return;
    }
    setReportBusy(true);
    setReportError(null);
    try {
      const { data, error: invokeError } = await client.functions.invoke('report-admin', {
        body: { action: 'list', status, priority, limit: 100, offset: 0 },
      });
      if (invokeError) throw invokeError;
      setItems((data?.items ?? []) as ReportItem[]);
    } catch {
      setReportError('Không thể tải reports. Tài khoản cần role moderator hoặc super_admin.');
    } finally {
      setReportBusy(false);
    }
  }, [status, priority]);

  const loadMedia = useCallback(async () => {
    const client = getAdminSupabaseClient();
    if (!client) {
      setMediaError('Supabase Admin chưa được cấu hình.');
      return;
    }
    setMediaBusy(true);
    setMediaError(null);
    try {
      const { data, error: invokeError } = await client.functions.invoke('media-moderation', {
        body: { action: 'list', moderationStatus: mediaStatus, limit: 50, offset: 0 },
      });
      if (invokeError) throw invokeError;
      setMediaItems((data?.items ?? []) as MediaItem[]);
      setMediaTotal(Number(data?.total_count ?? 0));
    } catch {
      setMediaError('Không thể tải hàng đợi ảnh. Tài khoản cần role moderator hoặc super_admin.');
    } finally {
      setMediaBusy(false);
    }
  }, [mediaStatus]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  async function reviewReport(item: ReportItem, action: 'start_review' | 'resolve' | 'dismiss') {
    let resolutionCode = '';
    if (action !== 'start_review') {
      resolutionCode = window.prompt(
        'Resolution code (ví dụ: no_violation, content_removed, account_action):',
        action === 'resolve' ? 'content_removed' : 'no_violation',
      )?.trim() ?? '';
      if (!/^[a-z][a-z0-9_]{1,63}$/u.test(resolutionCode)) return;
    }
    const client = getAdminSupabaseClient();
    if (!client) return;
    setReportBusy(true);
    setReportError(null);
    try {
      const { error: invokeError } = await client.functions.invoke('report-admin', {
        body: {
          action,
          reportId: item.report_id,
          resolutionCode,
          requestId: crypto.randomUUID(),
        },
      });
      if (invokeError) throw invokeError;
      await loadReports();
    } catch {
      setReportError('Thao tác kiểm duyệt thất bại hoặc tài khoản hiện tại không có quyền.');
    } finally {
      setReportBusy(false);
    }
  }

  async function reviewMedia(item: MediaItem, action: MediaAction) {
    const destructive = action === 'reject' || action === 'delete' || action === 'quarantine';
    if (destructive && !window.confirm(`${mediaActionLabel(action)} ảnh ${item.media_id.slice(0, 8)}?`)) return;

    const reasonCode = window.prompt('Reason code:', defaultReasonCode(action))?.trim() ?? '';
    if (!/^[a-z][a-z0-9_]{1,63}$/u.test(reasonCode)) return;
    const notes = window.prompt('Ghi chú kiểm duyệt (không bắt buộc):', '')?.trim() || null;

    const client = getAdminSupabaseClient();
    if (!client) return;
    setMediaBusy(true);
    setMediaError(null);
    try {
      const { error: invokeError } = await client.functions.invoke('media-moderation', {
        body: {
          action,
          mediaId: item.media_id,
          reasonCode,
          notes,
          requestId: crypto.randomUUID(),
        },
      });
      if (invokeError) throw invokeError;
      await loadMedia();
    } catch {
      setMediaError('Thao tác ảnh thất bại. Không có thay đổi được giả định là đã thành công.');
    } finally {
      setMediaBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <section style={{ display: 'grid', gap: 14 }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>Ảnh hồ sơ & avatar</h2>
          <p style={{ margin: 0 }}>
            Ảnh chờ duyệt được xếp mới nhất trước. Ảnh mới vẫn riêng tư và ảnh đã duyệt trước đó tiếp tục hiển thị cho đến khi bản thay thế được duyệt.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <select aria-label="Trạng thái ảnh" onChange={(event) => setMediaStatus(event.target.value as MediaStatus)} value={mediaStatus}>
            {Object.entries(mediaStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button disabled={mediaBusy} onClick={() => void loadMedia()} type="button">{mediaBusy ? 'Đang tải…' : 'Làm mới ảnh'}</button>
          <span><strong>{mediaTotal}</strong> ảnh</span>
        </div>
        {mediaError ? <p role="alert" style={{ color: '#b91c1c' }}>{mediaError}</p> : null}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 1180, width: '100%' }}>
            <thead>
              <tr>
                {['Ảnh', 'Thành viên', 'Loại', 'Case', 'Trạng thái', 'Thời gian', 'Thao tác'].map((label) => (
                  <th key={label} style={{ borderBottom: '1px solid #ddd', padding: 10, textAlign: 'left' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mediaItems.map((item) => (
                <tr key={item.media_id}>
                  <td style={{ padding: 10, verticalAlign: 'top' }}>
                    {item.preview_url ? (
                      <img
                        alt={`Ảnh ${item.visibility} của ${item.owner_display_name || item.owner_email || item.owner_id}`}
                        src={item.preview_url}
                        style={{ borderRadius: 8, height: 112, objectFit: 'cover', width: 84 }}
                      />
                    ) : <small>Không có preview</small>}
                    <br />
                    <small>{item.media_id.slice(0, 8)}</small>
                  </td>
                  <td style={{ padding: 10, verticalAlign: 'top' }}>
                    <strong>{item.owner_display_name || item.owner_username || item.owner_email || item.owner_id.slice(0, 8)}</strong>
                    {item.review_alert ? (
                      <div style={{ marginTop: 5 }}>
                        <span style={{ background: '#fee2e2', borderRadius: 999, color: '#b91c1c', display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '4px 8px' }}>
                          {item.review_alert}
                        </span>
                      </div>
                    ) : null}
                    {item.owner_email ? <><br /><small>{item.owner_email}</small></> : null}
                    {item.owner_username ? <><br /><small>@{item.owner_username}</small></> : null}
                    <br /><small>ID {item.owner_id.slice(0, 8)}</small>
                  </td>
                  <td style={{ padding: 10, verticalAlign: 'top' }}>
                    <strong>{item.visibility}</strong><br />
                    <small>{item.mime_type}</small>
                  </td>
                  <td style={{ padding: 10, verticalAlign: 'top' }}>
                    <strong>{item.priority?.toUpperCase() || 'NORMAL'}</strong><br />
                    <small>{item.case_status || '—'}{item.case_id ? ` · ${item.case_id.slice(0, 8)}` : ''}</small>
                    {item.rule_codes?.length ? <><br /><small>{item.rule_codes.join(', ')}</small></> : null}
                  </td>
                  <td style={{ padding: 10, verticalAlign: 'top' }}>
                    {mediaStatusLabels[item.moderation_status] ?? item.moderation_status}
                    {item.moderation_reason_code ? <><br /><small>{item.moderation_reason_code}</small></> : null}
                  </td>
                  <td style={{ padding: 10, verticalAlign: 'top' }}>
                    {new Date(item.uploaded_at || item.created_at).toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: 10, verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {mediaActions(item.moderation_status).map((action) => (
                        <button disabled={mediaBusy} key={action} onClick={() => void reviewMedia(item, action)} type="button">
                          {mediaActionLabel(action)}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!mediaBusy && mediaItems.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 16 }}>Không có ảnh ở trạng thái này.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 14 }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>Báo cáo thành viên</h2>
          <p style={{ margin: 0 }}>Xử lý report theo mức ưu tiên. Mọi quyết định tiếp tục được ghi vào admin audit log.</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <select aria-label="Trạng thái report" onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="">Mọi trạng thái</option>
            <option value="submitted">Submitted</option>
            <option value="triaged">Triaged</option>
            <option value="in_review">In review</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <select aria-label="Mức ưu tiên" onChange={(event) => setPriority(event.target.value)} value={priority}>
            <option value="">Mọi ưu tiên</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          <button disabled={reportBusy} onClick={() => void loadReports()} type="button">{reportBusy ? 'Đang tải…' : 'Làm mới reports'}</button>
        </div>
        {reportError ? <p role="alert" style={{ color: '#b91c1c' }}>{reportError}</p> : null}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 1100, width: '100%' }}>
            <thead>
              <tr>
                {['Report', 'Người báo cáo', 'Đối tượng', 'Lý do', 'Trạng thái', 'Thời gian', 'Thao tác'].map((label) => (
                  <th key={label} style={{ borderBottom: '1px solid #ddd', padding: 10, textAlign: 'left' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.report_id}>
                  <td style={{ padding: 10 }}><strong>{item.priority.toUpperCase()}</strong><br /><small>{item.report_id.slice(0, 8)}</small></td>
                  <td style={{ padding: 10 }}>{item.reporter_display_name || item.reporter_username || item.reporter_id.slice(0, 8)}</td>
                  <td style={{ padding: 10 }}>
                    {item.target_display_name || item.target_username || item.target_user_id?.slice(0, 8) || '—'}
                    {item.target_media_id ? <><br /><small>Media {item.target_media_id.slice(0, 8)}</small></> : null}
                    {item.target_message_id ? <><br /><small>Message {item.target_message_id.slice(0, 8)}</small></> : null}
                  </td>
                  <td style={{ padding: 10 }}><strong>{item.reason_code}</strong>{item.description ? <><br /><small>{item.description}</small></> : null}</td>
                  <td style={{ padding: 10 }}>{item.status}{item.resolution_code ? <><br /><small>{item.resolution_code}</small></> : null}</td>
                  <td style={{ padding: 10 }}>{new Date(item.created_at).toLocaleString('vi-VN')}</td>
                  <td style={{ padding: 10 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {!['resolved', 'dismissed'].includes(item.status) && item.status !== 'in_review' ? (
                        <button disabled={reportBusy} onClick={() => void reviewReport(item, 'start_review')} type="button">Nhận review</button>
                      ) : null}
                      {!['resolved', 'dismissed'].includes(item.status) ? (
                        <button disabled={reportBusy} onClick={() => void reviewReport(item, 'resolve')} type="button">Resolve</button>
                      ) : null}
                      {!['resolved', 'dismissed'].includes(item.status) ? (
                        <button disabled={reportBusy} onClick={() => void reviewReport(item, 'dismiss')} type="button">Dismiss</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p><small>Ưu tiên urgent/high trước. Queue report này không bao gồm Activity legacy.</small></p>
      </section>
    </div>
  );
}
