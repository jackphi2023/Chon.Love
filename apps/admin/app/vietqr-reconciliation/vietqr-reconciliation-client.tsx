'use client';

import {
  decideVietqrReconciliation,
  formatVnd,
  getVietqrReconciliationStatusLabel,
  importVietqrBankTransaction,
  listVietqrReconciliationQueue,
  type VietqrReconciliationDecision,
  type VietqrReconciliationQueueItem,
  type VietqrReconciliationStatus,
} from '@myfan/supabase';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAdminSupabaseClient } from '../../src/lib/supabase';

type QueueState =
  | { status: 'loading'; items: VietqrReconciliationQueueItem[] }
  | { status: 'ready'; items: VietqrReconciliationQueueItem[] }
  | { status: 'error'; items: VietqrReconciliationQueueItem[]; message: string };

type ImportForm = {
  provider: string;
  transactionRef: string;
  amountVnd: string;
  transferContent: string;
  occurredAt: string;
};

const statuses: Array<{ value: VietqrReconciliationStatus | ''; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'matched', label: 'Đã khớp' },
  { value: 'needs_review', label: 'Cần kiểm tra' },
  { value: 'unmatched', label: 'Chưa khớp' },
  { value: 'settled', label: 'Đã ghi có' },
  { value: 'ignored', label: 'Đã bỏ qua' },
  { value: 'rejected', label: 'Đã từ chối' },
];

function localDateTimeValue(date = new Date()): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function readableError(error: unknown): string {
  const code = error instanceof Error ? error.message : 'vietqr_reconciliation_admin_failed';
  switch (code) {
    case 'required_admin_role_missing': return 'Tài khoản cần role finance_admin hoặc super_admin.';
    case 'vietqr_reconciliation_disabled': return 'Inbox đối soát đang bị khóa bằng cấu hình database.';
    case 'vietqr_manual_settlement_disabled': return 'Ghi có thủ công đang bị khóa. BR-07 mặc định không bật settlement.';
    case 'vietqr_amount_mismatch': return 'Số tiền giao dịch không khớp đơn VietQR.';
    case 'vietqr_order_already_paid': return 'Đơn VietQR đã được thanh toán bằng giao dịch khác.';
    case 'vietqr_transaction_already_final': return 'Giao dịch đã ở trạng thái cuối.';
    default: return code;
  }
}

export function VietqrReconciliationClient() {
  const [queue, setQueue] = useState<QueueState>({ status: 'loading', items: [] });
  const [filter, setFilter] = useState<VietqrReconciliationStatus | ''>('');
  const [reloadToken, setReloadToken] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<ImportForm>({
    provider: 'manual_csv',
    transactionRef: '',
    amountVnd: '',
    transferContent: '',
    occurredAt: localDateTimeValue(),
  });
  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const client = getAdminSupabaseClient();
    if (!client) {
      setQueue({ status: 'error', items: [], message: 'Supabase Admin chưa được cấu hình.' });
      return () => { active = false; };
    }
    setQueue((current) => ({ status: 'loading', items: current.items }));
    void client.auth.getUser()
      .then(({ data }) => {
        if (!data.user) throw new Error('authentication_required');
        return listVietqrReconciliationQueue(client, { status: filter || null });
      })
      .then((items) => {
        if (active) setQueue({ status: 'ready', items });
      })
      .catch((error: unknown) => {
        if (active) setQueue({ status: 'error', items: [], message: readableError(error) });
      });
    return () => { active = false; };
  }, [filter, reloadToken]);

  const totals = useMemo(() => {
    return queue.items.reduce<Record<string, number>>((summary, item) => {
      summary[item.status] = (summary[item.status] ?? 0) + 1;
      return summary;
    }, {});
  }, [queue.items]);

  async function submitImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getAdminSupabaseClient();
    if (!client) return;
    const amountVnd = Number(form.amountVnd);
    if (!Number.isSafeInteger(amountVnd) || amountVnd <= 0) {
      setNotice('Số tiền phải là số nguyên dương.');
      return;
    }
    setBusyId('import');
    setNotice(null);
    try {
      const result = await importVietqrBankTransaction(client, {
        provider: form.provider,
        transactionRef: form.transactionRef,
        amountVnd,
        transferContent: form.transferContent,
        occurredAt: new Date(form.occurredAt).toISOString(),
      });
      setNotice(`${result.already_imported ? 'Giao dịch đã tồn tại' : 'Đã import'} · ${getVietqrReconciliationStatusLabel(result.status)}.`);
      setForm((current) => ({ ...current, transactionRef: '', amountVnd: '', transferContent: '', occurredAt: localDateTimeValue() }));
      reload();
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setBusyId(null);
    }
  }

  async function decide(item: VietqrReconciliationQueueItem, decision: VietqrReconciliationDecision) {
    const client = getAdminSupabaseClient();
    if (!client) return;
    let orderId: string | null = null;
    let reasonCode: string | null = null;
    if (decision === 'match') {
      orderId = window.prompt('UUID đơn VietQR cần liên kết:', item.matched_order_id ?? '')?.trim() || null;
      if (!orderId) return;
    }
    if (decision === 'ignore' || decision === 'reject') {
      reasonCode = window.prompt('Mã lý do audit, ví dụ non_myfan_transfer hoặc amount_mismatch:', decision === 'ignore' ? 'non_myfan_transfer' : 'amount_mismatch')?.trim() || null;
      if (!reasonCode) return;
    }
    if (decision === 'settle' && !window.confirm('Xác nhận yêu cầu ghi có ❤️ cho giao dịch khớp chính xác? Tác vụ vẫn fail closed nếu settlement chưa được bật.')) return;

    setBusyId(item.transaction_id);
    setNotice(null);
    try {
      const result = await decideVietqrReconciliation(client, {
        transactionId: item.transaction_id,
        decision,
        orderId,
        reasonCode,
      });
      setNotice(`Đã cập nhật: ${getVietqrReconciliationStatusLabel(result.status)}${result.already_processed ? ' (idempotent)' : ''}.`);
      reload();
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="adminModerationShell">
      <header className="adminModerationHeader">
        <div>
          <p className="adminEyebrow">FINANCE CONTROL · BR-07</p>
          <h1>Đối soát VietQR</h1>
          <p>Import giao dịch ngân hàng, khớp mã chuyển khoản và xử lý ngoại lệ. Import không tự cộng ❤️; ghi có chỉ đi qua quyết định finance_admin đã audit và mặc định bị khóa bằng feature flag.</p>
        </div>
        <div className="adminActions">
          <button className="adminSecondary" onClick={reload} type="button">Tải lại</button>
          <Link className="adminSecondary" href="/activity-moderation">Kiểm duyệt</Link>
          <Link className="adminSecondary" href="/">Tài khoản</Link>
        </div>
      </header>

      <section className="adminFinanceNotice">
        <strong>Fail closed:</strong> VietQR web order, manual settlement và automatic settlement đều được migration BR-07 đặt về <code>false</code>. Không có webhook ngân hàng công khai trong MVP này.
      </section>

      <form className="adminReconciliationForm" onSubmit={submitImport}>
        <div className="adminSectionHeading"><div><p className="adminEyebrow">MANUAL IMPORT</p><h2>Thêm giao dịch ngân hàng</h2></div></div>
        <label>Nguồn dữ liệu<input onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))} required value={form.provider} /></label>
        <label>Mã giao dịch ngân hàng<input onChange={(event) => setForm((current) => ({ ...current, transactionRef: event.target.value }))} required value={form.transactionRef} /></label>
        <label>Số tiền VNĐ<input inputMode="numeric" min="1" onChange={(event) => setForm((current) => ({ ...current, amountVnd: event.target.value }))} required type="number" value={form.amountVnd} /></label>
        <label>Thời gian giao dịch<input onChange={(event) => setForm((current) => ({ ...current, occurredAt: event.target.value }))} required type="datetime-local" value={form.occurredAt} /></label>
        <label className="adminWideField">Nội dung chuyển khoản<textarea maxLength={500} onChange={(event) => setForm((current) => ({ ...current, transferContent: event.target.value }))} required rows={3} value={form.transferContent} /></label>
        <div className="adminActions adminWideField"><button className="adminPrimary" disabled={busyId === 'import'} type="submit">{busyId === 'import' ? 'Đang import…' : 'Import vào inbox'}</button></div>
      </form>

      {notice ? <div className="adminState adminCompactState" role="status">{notice}</div> : null}

      <section className="adminReconciliationQueue">
        <div className="adminSectionHeading">
          <div><p className="adminEyebrow">RECONCILIATION INBOX</p><h2>Hàng đợi đối soát</h2></div>
          <label>Trạng thái<select onChange={(event) => setFilter(event.target.value as VietqrReconciliationStatus | '')} value={filter}>{statuses.map((item) => <option key={item.value || 'all'} value={item.value}>{item.label}</option>)}</select></label>
        </div>
        <div className="adminSummaryStrip">
          <span>Đã khớp: <strong>{totals.matched ?? 0}</strong></span>
          <span>Cần kiểm tra: <strong>{totals.needs_review ?? 0}</strong></span>
          <span>Chưa khớp: <strong>{totals.unmatched ?? 0}</strong></span>
          <span>Đã ghi có: <strong>{totals.settled ?? 0}</strong></span>
        </div>

        {queue.status === 'loading' && queue.items.length === 0 ? <div className="adminState">Đang tải inbox…</div> : null}
        {queue.status === 'error' ? <div className="adminState adminError" role="alert"><strong>{queue.message}</strong><button className="adminSecondary" onClick={reload} type="button">Thử lại</button></div> : null}
        {queue.status === 'ready' && queue.items.length === 0 ? <div className="adminState"><strong>Không có giao dịch</strong><p>Inbox chưa có dữ liệu theo bộ lọc hiện tại.</p></div> : null}

        <div className="adminReconciliationList">
          {queue.items.map((item) => (
            <article className="adminReconciliationCard" key={item.transaction_id}>
              <header><div><strong>{formatVnd(item.amount_vnd)}</strong><small>{item.provider} · {item.provider_transaction_ref}</small></div><span data-status={item.status}>{getVietqrReconciliationStatusLabel(item.status)}</span></header>
              <p className="adminTransferContent">{item.transfer_content_raw}</p>
              <dl className="adminMetaGrid">
                <div><dt>Thời gian</dt><dd>{new Date(item.occurred_at).toLocaleString('vi-VN')}</dd></div>
                <div><dt>Đơn</dt><dd>{item.order_code ?? 'Chưa xác định'}</dd></div>
                <div><dt>Kỳ vọng</dt><dd>{item.expected_amount_vnd ? formatVnd(item.expected_amount_vnd) : '—'}</dd></div>
                <div><dt>Người dùng</dt><dd>{item.display_name ?? '—'}</dd></div>
              </dl>
              {item.review_reason_code ? <p className="adminGiftRequirement">Audit reason: {item.review_reason_code}</p> : null}
              {!['settled', 'ignored', 'rejected'].includes(item.status) ? (
                <div className="adminActions">
                  <button className="adminSecondary" disabled={busyId === item.transaction_id} onClick={() => void decide(item, 'match')} type="button">Liên kết đơn</button>
                  {item.matched_order_id && item.amount_vnd === item.expected_amount_vnd ? <button className="adminPrimary" disabled={busyId === item.transaction_id} onClick={() => void decide(item, 'settle')} type="button">Xác nhận ghi có</button> : null}
                  <button className="adminSecondary" disabled={busyId === item.transaction_id} onClick={() => void decide(item, 'ignore')} type="button">Bỏ qua</button>
                  <button className="adminDanger" disabled={busyId === item.transaction_id} onClick={() => void decide(item, 'reject')} type="button">Từ chối</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
