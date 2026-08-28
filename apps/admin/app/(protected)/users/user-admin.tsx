'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getAdminSupabaseClient } from '../../../src/lib/supabase';

type UserItem = {
  user_id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  gender: string;
  age: number | null;
  profile_status: string;
  discovery_enabled: boolean;
  last_active_at: string | null;
  membership_tier: 'free' | 'premium' | 'diamond';
  membership_expires_at: string | null;
  identity_status: string;
  linkedin_status: string;
  reports_received: number;
  blocks_received: number;
};

type ListingReviewItem = {
  user_id: string;
  public_profile_code: string | null;
  username: string | null;
  display_name: string | null;
  listing_status: 'pending';
  listing_submitted_at: string | null;
  membership_tier: 'free' | 'premium' | 'diamond';
  is_paid_override: boolean;
  discovery_preference_enabled: boolean;
  effective_discoverable: boolean;
  updated_at: string;
};

type AdminMediaItem = {
  id: string;
  media_type: string;
  mime_type: string;
  visibility: string;
  moderation_status: string;
  moderation_reason_code: string | null;
  uploaded_at: string | null;
  created_at: string;
  width: number | null;
  height: number | null;
  signed_url: string | null;
};

type VerificationSelfie = {
  signed_url: string | null;
  created_at: string | null;
};

type Detail = {
  account?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  membership?: Record<string, unknown>;
  verification?: Record<string, unknown>;
  counts?: Record<string, unknown>;
  roles?: unknown[];
  age?: number | null;
  account_status?: string | null;
  media?: AdminMediaItem[];
  verification_selfies?: VerificationSelfie[];
  share_profile_url?: string | null;
};

function textValue(record: Record<string, unknown> | undefined, key: string, fallback = '—') {
  const value = record?.[key];
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function dateTime(value: unknown) {
  if (typeof value !== 'string' || !value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function mediaVisibilityLabel(value: string) {
  if (value === 'avatar') return 'Ảnh đại diện';
  if (value === 'public') return 'Công khai';
  if (value === 'private') return 'Ảnh ẩn';
  return value;
}

function moderationLabel(value: string) {
  if (value === 'approved') return 'Đã duyệt';
  if (value === 'pending_review') return 'Chờ duyệt';
  if (value === 'rejected') return 'Bị từ chối';
  if (value === 'removed') return 'Đã ẩn';
  return value;
}

export function UserAdmin() {
  const [items, setItems] = useState<UserItem[]>([]);
  const [listingItems, setListingItems] = useState<ListingReviewItem[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selected, setSelected] = useState<UserItem | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [tier, setTier] = useState('');
  const [busy, setBusy] = useState(false);
  const [listingBusy, setListingBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listingError, setListingError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const client = getAdminSupabaseClient();
    if (!client) { setError('Supabase Admin chưa được cấu hình.'); return; }
    setBusy(true);
    setError(null);
    try {
      const { data, error: invokeError } = await client.functions.invoke('user-admin', {
        body: { action: 'list', query, status, tier, limit: 100, offset: 0 },
      });
      if (invokeError) throw invokeError;
      setItems((data?.items ?? []) as UserItem[]);
    } catch {
      setError('Không thể tải danh sách. Tài khoản hiện tại cần role super_admin.');
    } finally { setBusy(false); }
  }, [query, status, tier]);

  const loadListingQueue = useCallback(async () => {
    const client = getAdminSupabaseClient();
    if (!client) { setListingError('Supabase Admin chưa được cấu hình.'); return; }
    setListingBusy(true);
    setListingError(null);
    try {
      const { data, error: invokeError } = await client.functions.invoke('user-admin', {
        body: { action: 'listing_queue', limit: 100, offset: 0 },
      });
      if (invokeError) throw invokeError;
      setListingItems((data?.items ?? []) as ListingReviewItem[]);
    } catch {
      setListingError('Không thể tải hàng chờ duyệt hồ sơ mới.');
    } finally { setListingBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadListingQueue(); }, [loadListingQueue]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await load();
  }

  async function openDetail(item: UserItem) {
    const client = getAdminSupabaseClient();
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: invokeError } = await client.functions.invoke('user-admin', { body: { action: 'detail', userId: item.user_id } });
      if (invokeError) throw invokeError;
      setSelected(item);
      setDetail((data?.item ?? null) as Detail | null);
    } catch { setError('Không thể tải chi tiết thành viên.'); }
    finally { setBusy(false); }
  }

  async function reviewListing(item: ListingReviewItem, reviewAction: 'approve' | 'reject') {
    const actionLabel = reviewAction === 'approve' ? 'duyệt hiển thị hồ sơ' : 'từ chối hiển thị hồ sơ';
    if (!window.confirm(`Xác nhận ${actionLabel} của ${item.display_name || item.username || item.user_id}?`)) return;
    const suggested = reviewAction === 'approve' ? 'admin_approved' : 'admin_rejected';
    const reasonCode = window.prompt('Reason code cho audit:', suggested)?.trim() || suggested;
    if (!/^[a-z][a-z0-9_]{1,63}$/u.test(reasonCode)) {
      setListingError('Reason code không hợp lệ.');
      return;
    }

    const client = getAdminSupabaseClient();
    if (!client) return;
    setListingBusy(true);
    setListingError(null);
    try {
      const { error: invokeError } = await client.functions.invoke('user-admin', {
        body: {
          action: 'listing_review',
          userId: item.user_id,
          reviewAction,
          reasonCode,
          requestId: crypto.randomUUID(),
        },
      });
      if (invokeError) throw invokeError;
      await Promise.all([loadListingQueue(), load()]);
    } catch {
      setListingError('Không thể lưu quyết định duyệt hiển thị hồ sơ.');
    } finally { setListingBusy(false); }
  }

  async function mutate(item: UserItem, action: 'status' | 'discovery', payload: Record<string, unknown>) {
    const reason = window.prompt('Lý do bắt buộc cho audit log:', 'support_review')?.trim();
    if (!reason) return;
    const client = getAdminSupabaseClient();
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      const { error: invokeError } = await client.functions.invoke('user-admin', {
        body: { action, userId: item.user_id, reason, requestId: crypto.randomUUID(), ...payload },
      });
      if (invokeError) throw invokeError;
      setDetail(null);
      setSelected(null);
      await Promise.all([load(), loadListingQueue()]);
    } catch { setError('Thao tác thất bại hoặc tài khoản không có quyền super_admin.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <section style={{ border: '1px solid #fecaca', borderRadius: 12, display: 'grid', gap: 12, padding: 14 }}>
        <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0 }}>Duyệt hiển thị hồ sơ mới</h2>
            <p style={{ margin: '5px 0 0' }}>Chỉ Free đã hoàn tất xác thực tin cậy nhưng chưa được duyệt hiển thị trong Connect. Premium/Diamond không vào hàng chờ này.</p>
          </div>
          <button disabled={listingBusy} onClick={() => void loadListingQueue()} type="button">
            {listingBusy ? 'Đang tải…' : `Làm mới (${listingItems.length})`}
          </button>
        </div>
        {listingError ? <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>{listingError}</p> : null}
        {!listingBusy && listingItems.length === 0 ? <p style={{ margin: 0 }}>Không có hồ sơ mới đang chờ duyệt.</p> : null}
        {listingItems.map((item) => (
          <article key={item.user_id} style={{ borderTop: '1px solid #fee2e2', display: 'grid', gap: 8, paddingTop: 12 }}>
            <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <strong>{item.display_name || item.username || item.user_id}</strong>
              <span style={{ background: '#fee2e2', borderRadius: 999, color: '#b91c1c', fontSize: 12, fontWeight: 700, padding: '4px 8px' }}>
                User mới cần duyệt
              </span>
            </div>
            <div style={{ fontSize: 13 }}>
              @{item.username || '—'} · ID {item.public_profile_code ? `id-${item.public_profile_code}` : item.user_id.slice(0, 8)} · Free
              {item.listing_submitted_at ? ` · Gửi ${new Date(item.listing_submitted_at).toLocaleString('vi-VN')}` : ''}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button disabled={listingBusy} onClick={() => void reviewListing(item, 'approve')} type="button">Duyệt hiển thị</button>
              <button disabled={listingBusy} onClick={() => void reviewListing(item, 'reject')} type="button">Từ chối</button>
            </div>
          </article>
        ))}
      </section>

      <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input aria-label="Tìm thành viên" onChange={(event) => setQuery(event.target.value)} placeholder="Email, username, tên hiển thị" style={{ minWidth: 260, padding: 10 }} value={query} />
        <select aria-label="Trạng thái" onChange={(event) => setStatus(event.target.value)} value={status}>
          <option value="">Mọi trạng thái</option><option value="active">Active</option><option value="pending_review">Pending review</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option>
        </select>
        <select aria-label="Gói thành viên" onChange={(event) => setTier(event.target.value)} value={tier}>
          <option value="">Mọi gói</option><option value="free">Free</option><option value="premium">Premium</option><option value="diamond">Diamond</option>
        </select>
        <button disabled={busy} type="submit">{busy ? 'Đang tải…' : 'Tìm kiếm'}</button>
      </form>

      {error ? <p role="alert" style={{ color: '#b91c1c' }}>{error}</p> : null}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 1050, width: '100%' }}>
          <thead><tr>{['Thành viên','Trạng thái','Gói','Xác thực','Hoạt động','Safety','Thao tác'].map((label) => <th key={label} style={{ borderBottom: '1px solid #ddd', padding: 10, textAlign: 'left' }}>{label}</th>)}</tr></thead>
          <tbody>{items.map((item) => (
            <tr key={item.user_id}>
              <td style={{ padding: 10 }}><strong>{item.display_name || item.username || '—'}</strong><div>{item.email}</div><small>{item.age ? `${item.age} tuổi · ` : ''}{item.gender}</small></td>
              <td style={{ padding: 10 }}>{item.profile_status}<br /><small>{item.discovery_enabled ? 'Discovery ON' : 'Discovery OFF'}</small></td>
              <td style={{ padding: 10 }}>{item.membership_tier}{item.membership_expires_at ? <><br /><small>đến {new Date(item.membership_expires_at).toLocaleDateString('vi-VN')}</small></> : null}</td>
              <td style={{ padding: 10 }}>CCCD: {item.identity_status}<br />LinkedIn: {item.linkedin_status}</td>
              <td style={{ padding: 10 }}>{item.last_active_at ? new Date(item.last_active_at).toLocaleString('vi-VN') : '—'}</td>
              <td style={{ padding: 10 }}>Reports: {item.reports_received}<br />Blocked by: {item.blocks_received}</td>
              <td style={{ padding: 10 }}><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button disabled={busy} onClick={() => void openDetail(item)} type="button">Chi tiết</button>
                {item.profile_status === 'suspended' ? <button disabled={busy} onClick={() => void mutate(item, 'status', { targetStatus: 'active' })} type="button">Mở khóa</button> : <button disabled={busy} onClick={() => void mutate(item, 'status', { targetStatus: 'suspended' })} type="button">Tạm khóa</button>}
                {item.profile_status !== 'deactivated' ? <button disabled={busy} onClick={() => void mutate(item, 'status', { targetStatus: 'deactivated' })} type="button">Vô hiệu</button> : null}
                <button disabled={busy} onClick={() => void mutate(item, 'discovery', { hidden: item.discovery_enabled })} type="button">{item.discovery_enabled ? 'Ẩn discovery' : 'Hiện discovery'}</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {selected && detail ? <UserDetailPanel detail={detail} selected={selected} /> : null}
    </div>
  );
}

function UserDetailPanel({ detail, selected }: { detail: Detail; selected: UserItem }) {
  const account = detail.account;
  const profile = detail.profile;
  const membership = detail.membership;
  const verification = detail.verification;
  const media = detail.media ?? [];
  const selfies = detail.verification_selfies ?? [];

  return (
    <section style={{ borderTop: '1px solid #ddd', display: 'grid', gap: 18, paddingTop: 18 }}>
      <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0 }}>Hồ sơ: {selected.display_name || selected.username || selected.email}</h2>
          <p style={{ margin: '5px 0 0' }}>Admin xem trực quan hồ sơ, toàn bộ ảnh hiện còn lưu và selfie xác thực của thành viên.</p>
        </div>
        {detail.share_profile_url ? (
          <a href={detail.share_profile_url} rel="noreferrer" target="_blank" style={{ border: '1px solid #b87800', borderRadius: 8, color: '#8a5b00', fontWeight: 700, padding: '9px 12px', textDecoration: 'none' }}>
            Xem hồ sơ chia sẻ
          </a>
        ) : null}
      </div>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <InfoCard label="Email" value={textValue(account, 'email')} />
        <InfoCard label="User ID" value={textValue(account, 'user_id')} />
        <InfoCard label="Trạng thái tài khoản" value={detail.account_status ?? '—'} />
        <InfoCard label="Trạng thái hồ sơ" value={textValue(profile, 'profile_status')} />
        <InfoCard label="Tuổi" value={detail.age === null || detail.age === undefined ? '—' : `${detail.age} tuổi`} />
        <InfoCard label="Gói thành viên" value={textValue(membership, 'tier', 'free')} />
        <InfoCard label="Đăng nhập gần nhất" value={dateTime(account?.last_sign_in_at)} />
        <InfoCard label="Tạo tài khoản" value={dateTime(account?.created_at)} />
        <InfoCard label="Xác thực CCCD" value={textValue(verification, 'identity_status', 'not_submitted')} />
        <InfoCard label="Xác thực LinkedIn" value={textValue(verification, 'linkedin_status', 'not_submitted')} />
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <h3 style={{ margin: 0 }}>Ảnh hồ sơ ({media.length})</h3>
        <p style={{ margin: 0 }}>Bao gồm ảnh đại diện, ảnh công khai, ảnh ẩn và ảnh đang chờ/bị từ chối nếu file vẫn còn hợp lệ.</p>
        {media.length ? (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {media.map((item) => <AdminImageCard item={item} key={item.id} />)}
          </div>
        ) : <p style={{ margin: 0 }}>Thành viên chưa có ảnh hồ sơ đang lưu.</p>}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <h3 style={{ margin: 0 }}>Selfie xác thực ({selfies.length})</h3>
        {selfies.length ? (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {selfies.map((item, index) => (
              <figure key={`${item.created_at ?? 'selfie'}-${index}`} style={{ border: '1px solid #e5e7eb', borderRadius: 10, margin: 0, overflow: 'hidden' }}>
                {item.signed_url ? <img alt={`Selfie xác thực ${index + 1}`} src={item.signed_url} style={{ aspectRatio: '4 / 5', display: 'block', objectFit: 'cover', width: '100%' }} /> : <ImageUnavailable />}
                <figcaption style={{ display: 'grid', gap: 3, padding: 8 }}>
                  <strong>{index === 0 ? 'Selfie gần nhất' : `Selfie ${index + 1}`}</strong>
                  <small>{dateTime(item.created_at)}</small>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : <p style={{ margin: 0 }}>Chưa có selfie xác thực.</p>}
      </div>

      <details>
        <summary>Thông tin hồ sơ đầy đủ</summary>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', paddingTop: 10 }}>
          {Object.entries(profile ?? {}).map(([key, value]) => (
            <InfoCard key={key} label={key.replaceAll('_', ' ')} value={value === null || value === undefined || value === '' ? '—' : String(value)} />
          ))}
        </div>
      </details>
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 9, display: 'grid', gap: 4, padding: 10 }}>
      <small style={{ color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>{label}</small>
      <span style={{ overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  );
}

function AdminImageCard({ item }: { item: AdminMediaItem }) {
  return (
    <figure style={{ border: '1px solid #e5e7eb', borderRadius: 10, margin: 0, overflow: 'hidden' }}>
      {item.signed_url ? <img alt={`${mediaVisibilityLabel(item.visibility)} của thành viên`} src={item.signed_url} style={{ aspectRatio: '4 / 5', display: 'block', objectFit: 'cover', width: '100%' }} /> : <ImageUnavailable />}
      <figcaption style={{ display: 'grid', gap: 3, padding: 8 }}>
        <strong>{mediaVisibilityLabel(item.visibility)}</strong>
        <small>{moderationLabel(item.moderation_status)}{item.moderation_reason_code ? ` · ${item.moderation_reason_code}` : ''}</small>
        <small>{item.width && item.height ? `${item.width}×${item.height} · ` : ''}{dateTime(item.uploaded_at ?? item.created_at)}</small>
      </figcaption>
    </figure>
  );
}

function ImageUnavailable() {
  return <div style={{ alignItems: 'center', aspectRatio: '4 / 5', background: '#f3f4f6', display: 'flex', justifyContent: 'center', padding: 12, textAlign: 'center' }}>Không thể mở ảnh</div>;
}
