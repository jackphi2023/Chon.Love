'use client';

import { invokeRuntimeObservabilityAdminSnapshot, type RuntimeSnapshotRow } from '@myfan/supabase';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAdminSupabaseClient } from '../../src/lib/supabase';

type State =
  | { status: 'loading'; items: RuntimeSnapshotRow[] }
  | { status: 'ready'; items: RuntimeSnapshotRow[] }
  | { status: 'error'; items: RuntimeSnapshotRow[]; message: string };

function readableError(error: unknown): string {
  const code = error instanceof Error ? error.message : 'runtime_observability_admin_failed';
  if (code.includes('required_admin_role_missing')) return 'Chỉ super_admin được xem số liệu runtime tổng hợp.';
  if (code.includes('authentication_required')) return 'Phiên đăng nhập đã hết hạn.';
  return 'Không thể tải số liệu runtime. Không có thao tác tự retry.';
}

export function RuntimeObservabilityClient() {
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<State>({ status: 'loading', items: [] });
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
        return invokeRuntimeObservabilityAdminSnapshot(client, { windowMinutes });
      })
      .then(({ items }) => { if (active) setState({ status: 'ready', items }); })
      .catch((error: unknown) => { if (active) setState({ status: 'error', items: [], message: readableError(error) }); });
    return () => { active = false; };
  }, [reloadToken, windowMinutes]);

  const totals = useMemo(() => state.items.reduce((result, item) => ({
    events: result.events + item.event_count,
    users: result.users + item.affected_users,
    retryable: result.retryable + item.retryable_count,
  }), { events: 0, users: 0, retryable: 0 }), [state.items]);

  return (
    <div className="adminModerationShell">
      <header className="adminModerationHeader">
        <div>
          <p className="adminEyebrow">OBSERVABILITY · ACCESSIBILITY · RESILIENCE · BR-09</p>
          <h1>Runtime health</h1>
          <p>Số liệu chỉ được tổng hợp theo mã sự kiện. Không hiển thị user ID, route chi tiết, PII, token, nội dung chat, KYC, ngân hàng hoặc giao dịch.</p>
        </div>
        <Link className="adminSecondary" href="/">Về Admin</Link>
      </header>

      <section aria-labelledby="runtime-summary-title" className="adminReconciliationQueue">
        <div className="adminSectionHeading">
          <div><p className="adminEyebrow">AGGREGATED SNAPSHOT</p><h2 id="runtime-summary-title">Sự kiện runtime</h2></div>
          <label htmlFor="runtime-window">Khoảng thời gian
            <select id="runtime-window" onChange={(event) => setWindowMinutes(Number(event.target.value))} value={windowMinutes}>
              <option value={15}>15 phút</option><option value={60}>60 phút</option><option value={360}>6 giờ</option><option value={1440}>24 giờ</option>
            </select>
          </label>
        </div>
        <div aria-live="polite" className="adminSummaryStrip">
          <span>Sự kiện: <strong>{totals.events}</strong></span>
          <span>Lượt người dùng tổng hợp: <strong>{totals.users}</strong></span>
          <span>Có thể retry: <strong>{totals.retryable}</strong></span>
        </div>
        {state.status === 'loading' ? <div aria-live="polite" className="adminState">Đang tải snapshot…</div> : null}
        {state.status === 'error' ? <div className="adminState adminError" role="alert"><strong>{state.message}</strong><button className="adminSecondary" onClick={reload} type="button">Thử lại thủ công</button></div> : null}
        {state.status === 'ready' && state.items.length === 0 ? <div className="adminState"><strong>Chưa có sự kiện</strong><p>Ingestion mặc định đang tắt và chỉ được bật sau phê duyệt vận hành.</p></div> : null}
        <div className="adminObservabilityGrid">
          {state.items.map((item) => (
            <article className="adminReconciliationCard" key={`${item.event_name}:${item.severity}`}>
              <header><div><strong>{item.event_name}</strong><small>Mức độ: {item.severity}</small></div><span data-status={item.severity}>{item.event_count}</span></header>
              <dl className="adminMetaGrid">
                <div><dt>Affected</dt><dd>{item.affected_users}</dd></div>
                <div><dt>Retryable</dt><dd>{item.retryable_count}</dd></div>
                <div><dt>Gần nhất</dt><dd>{new Date(item.latest_at).toLocaleString('vi-VN')}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
