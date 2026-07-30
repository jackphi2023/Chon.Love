'use client';

import {
  createActivityStorageUrl,
  listActivityModerationQueue,
  moderateCreatorActivityPost,
  type ActivityModerationQueueItem,
} from '@myfan/supabase';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAdminSupabaseClient } from '../../src/lib/supabase';

type QueueItem = ActivityModerationQueueItem & { previewUrl: string | null; originalUrl: string | null };
type QueueState =
  | { status: 'loading'; items: QueueItem[] }
  | { status: 'ready'; items: QueueItem[] }
  | { status: 'error'; items: QueueItem[]; message: string };

export function ActivityModerationClient() {
  const [state, setState] = useState<QueueState>({ status: 'loading', items: [] });
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const client = getAdminSupabaseClient();
    if (!client) {
      setState({ status: 'error', items: [], message: 'Supabase Admin chưa được cấu hình.' });
      return () => { active = false; };
    }
    setState((current) => ({ status: 'loading', items: current.items }));
    void client.auth.getUser()
      .then(({ data }) => {
        if (!data.user) throw new Error('authentication_required');
        return listActivityModerationQueue(client);
      })
      .then(async (items) => Promise.all(items.map(async (item) => ({
        ...item,
        previewUrl: item.preview_bucket && item.preview_path
          ? await createActivityStorageUrl(client, item.preview_bucket, item.preview_path, 30).catch(() => null)
          : null,
        originalUrl: item.original_bucket && item.original_path
          ? await createActivityStorageUrl(client, item.original_bucket, item.original_path, 30).catch(() => null)
          : null,
      }))))
      .then((items) => {
        if (active) setState({ status: 'ready', items });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error && error.message.includes('moderator_role_required')
          ? 'Tài khoản chưa có role moderator hoặc super_admin.'
          : 'Không thể tải hàng đợi kiểm duyệt.';
        if (active) setState({ status: 'error', items: [], message });
      });
    return () => { active = false; };
  }, [reloadToken]);

  async function decide(item: QueueItem, action: 'approve' | 'reject') {
    const client = getAdminSupabaseClient();
    if (!client) return;
    const reasonCode = action === 'approve' ? 'activity_policy_passed' : window.prompt('Mã lý do từ chối, ví dụ sexual_content hoặc unsafe_external_link:', 'policy_violation')?.trim();
    if (!reasonCode) return;
    const notes = window.prompt('Ghi chú kiểm duyệt nội bộ (không bắt buộc):', '') ?? '';
    setBusyPostId(item.post_id);
    try {
      await moderateCreatorActivityPost(client, { postId: item.post_id, action, reasonCode, notes });
      reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'moderation_failed');
    } finally {
      setBusyPostId(null);
    }
  }

  return (
    <div className="adminModerationShell">
      <header className="adminModerationHeader">
        <div><p className="adminEyebrow">CREATOR ACTIVITY</p><h1>Kiểm duyệt Hoạt động</h1><p>Text, link, preview mờ và original đều được xem qua quyền moderator. Mọi quyết định được ghi audit log.</p></div>
        <div className="adminActions"><button className="adminSecondary" onClick={reload} type="button">Tải lại</button><Link className="adminSecondary" href="/">Tài khoản</Link></div>
      </header>
      {state.status === 'loading' && state.items.length === 0 ? <div className="adminState">Đang tải hàng đợi…</div> : null}
      {state.status === 'error' ? <div className="adminState adminError" role="alert"><strong>{state.message}</strong><button className="adminSecondary" onClick={reload} type="button">Thử lại</button></div> : null}
      {state.status === 'ready' && state.items.length === 0 ? <div className="adminState"><strong>Hàng đợi đang trống</strong><p>Chưa có bài pending_review hoặc rejected.</p></div> : null}
      <div className="adminModerationGrid">
        {state.items.map((item) => (
          <article className="adminModerationCard" key={item.post_id}>
            <header><div><strong>{item.display_name}</strong><small>@{item.username}</small></div><span>{item.moderation_status}</span></header>
            <p className="adminPostBody">{item.body}</p>
            <dl className="adminMetaGrid">
              <div><dt>Dạng</dt><dd>{item.content_type}</dd></div>
              <div><dt>Quyền ảnh</dt><dd>{item.image_access_mode}</dd></div>
              <div><dt>Mở khóa</dt><dd>{item.unlock_count}</dd></div>
              <div><dt>Báo cáo</dt><dd>{item.report_count}</dd></div>
            </dl>
            {item.external_url ? <a className="adminExternalLink" href={item.external_url} rel="noreferrer" target="_blank">{item.external_provider}: {item.external_url}</a> : null}
            {item.required_gift_name_vi ? <p className="adminGiftRequirement">Yêu cầu: {item.required_gift_name_vi} · {item.required_gift_hearts} ❤️</p> : null}
            {item.previewUrl || item.originalUrl ? (
              <div className="adminMediaCompare">
                <figure>{item.previewUrl ? <img alt="Preview mờ server-side" src={item.previewUrl} /> : <div>Chưa có preview</div>}<figcaption>Preview mờ</figcaption></figure>
                <figure>{item.originalUrl ? <img alt="Original bảo vệ" src={item.originalUrl} /> : <div>Không có original</div>}<figcaption>Original protected</figcaption></figure>
              </div>
            ) : null}
            <p className="adminMediaState">Media moderation: {item.media_moderation_status ?? 'không có ảnh'}</p>
            <div className="adminActions">
              <button className="adminPrimary" disabled={busyPostId === item.post_id} onClick={() => void decide(item, 'approve')} type="button">Duyệt</button>
              <button className="adminDanger" disabled={busyPostId === item.post_id} onClick={() => void decide(item, 'reject')} type="button">Từ chối</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
