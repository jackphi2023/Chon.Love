'use client';

import {
  decideBankReview,
  decideKycReview,
  formatVnd,
  getBankReviewPayload,
  getKycDocumentAccess,
  getKycReviewPayload,
  listPayoutOperationalQueue,
  operateWithdrawal,
  payoutStatusLabel,
  startPayoutOperationalReview,
  withdrawalNextStepLabel,
  withdrawalOperationsForStatus,
  type BankQueueItem,
  type KycQueueItem,
  type PayoutQueueKind,
  type WithdrawalOperation,
  type WithdrawalQueueItem,
} from '@myfan/supabase';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAdminSupabaseClient } from '../../src/lib/supabase';

type QueueItem = KycQueueItem | BankQueueItem | WithdrawalQueueItem;
type QueueState =
  | { status: 'loading'; items: QueueItem[] }
  | { status: 'ready'; items: QueueItem[] }
  | { status: 'error'; items: QueueItem[]; message: string };

type PaymentDraft = {
  withdrawalId: string;
  reference: string;
  evidenceSha256: string;
};

const kinds: Array<{ value: PayoutQueueKind; label: string }> = [
  { value: 'withdrawal', label: 'Yêu cầu rút tiền' },
  { value: 'bank', label: 'Tài khoản ngân hàng' },
  { value: 'kyc', label: 'KYC' },
];

const statusOptions: Record<PayoutQueueKind, string[]> = {
  kyc: ['', 'pending', 'approved', 'rejected', 'expired', 'suspended'],
  bank: ['', 'pending', 'verified', 'rejected', 'disabled'],
  withdrawal: ['', 'pending', 'under_review', 'approved', 'processing', 'paid', 'rejected', 'cancelled', 'reversed'],
};

function readableError(error: unknown): string {
  const code = error instanceof Error ? error.message : 'payout_admin_failed';
  const labels: Record<string, string> = {
    authentication_required: 'Cần đăng nhập Admin.',
    required_admin_role_missing: 'Tài khoản cần role finance_admin hoặc super_admin.',
    kyc_operational_review_enabled_disabled: 'KYC operational review đang bị khóa bằng database flag.',
    bank_account_operational_review_enabled_disabled: 'Bank operational review đang bị khóa bằng database flag.',
    withdrawal_operational_review_enabled_disabled: 'Withdrawal review đang bị khóa bằng database flag.',
    withdrawal_processing_enabled_disabled: 'Bước xử lý chuyển tiền đang bị khóa.',
    withdrawal_payout_enabled_disabled: 'Bước ghi nhận đã thanh toán đang bị khóa.',
    kyc_review_assignment_required: 'Hồ sơ KYC chưa được giao cho tài khoản hiện tại.',
    bank_review_assignment_required: 'Tài khoản ngân hàng chưa được giao cho tài khoản hiện tại.',
    withdrawal_review_assignment_required: 'Yêu cầu rút tiền chưa được giao cho tài khoản hiện tại.',
    withdrawal_dual_control_required: 'Người duyệt không được đồng thời là người xử lý/ghi nhận thanh toán.',
    payment_evidence_sha256_required: 'Cần SHA-256 chứng từ thanh toán hợp lệ.',
    payment_reference_required: 'Cần mã tham chiếu chuyển khoản.',
    pii_encryption_configuration_missing: 'Server chưa có khóa giải mã PII.',
  };
  return labels[code] ?? code;
}

function entityId(kind: PayoutQueueKind, item: QueueItem): string {
  if (kind === 'kyc') return (item as KycQueueItem).kyc_profile_id;
  if (kind === 'bank') return (item as BankQueueItem).bank_account_id;
  return (item as WithdrawalQueueItem).withdrawal_id;
}

export function KycWithdrawalOperationsClient() {
  const [kind, setKind] = useState<PayoutQueueKind>('withdrawal');
  const [filter, setFilter] = useState('');
  const [queue, setQueue] = useState<QueueState>({ status: 'loading', items: [] });
  const [reloadToken, setReloadToken] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null);
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
        return listPayoutOperationalQueue(client, { kind, status: filter || null });
      })
      .then((items) => { if (active) setQueue({ status: 'ready', items }); })
      .catch((error: unknown) => { if (active) setQueue({ status: 'error', items: [], message: readableError(error) }); });
    return () => { active = false; };
  }, [kind, filter, reloadToken]);

  const total = useMemo(() => queue.items[0] ? Number((queue.items[0] as { total_count?: number }).total_count ?? queue.items.length) : 0, [queue.items]);

  async function claim(item: QueueItem) {
    const client = getAdminSupabaseClient();
    if (!client) return;
    const id = entityId(kind, item);
    setBusyId(id);
    setNotice(null);
    try {
      await startPayoutOperationalReview(client, { kind, entityId: id });
      setNotice('Đã nhận hồ sơ. Trạng thái và SLA đã được cập nhật.');
      reload();
    } catch (error) { setNotice(readableError(error)); }
    finally { setBusyId(null); }
  }

  async function inspectKyc(item: KycQueueItem) {
    const client = getAdminSupabaseClient();
    if (!client) return;
    setBusyId(item.kyc_profile_id);
    setNotice(null);
    try {
      const payload = await getKycReviewPayload(client, { kycProfileId: item.kyc_profile_id });
      const openDocument = payload.documentIds.length > 0 && window.confirm(
        `Họ tên: ${payload.legalName}\nGiấy tờ: ${payload.documentType} · ${payload.documentNumber}\nQuốc gia: ${payload.countryCode}\n\nMở chứng từ đầu tiên bằng signed URL 60 giây?`,
      );
      if (openDocument) {
        const access = await getKycDocumentAccess(client, { kycDocumentId: payload.documentIds[0]! });
        window.open(access.signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) { setNotice(readableError(error)); }
    finally { setBusyId(null); }
  }

  async function inspectBank(item: BankQueueItem) {
    const client = getAdminSupabaseClient();
    if (!client) return;
    setBusyId(item.bank_account_id);
    setNotice(null);
    try {
      const payload = await getBankReviewPayload(client, { bankAccountId: item.bank_account_id });
      window.alert(`Ngân hàng: ${payload.bankCode}\nChủ tài khoản: ${payload.accountHolder}\nSố tài khoản: ${payload.accountNumber}`);
    } catch (error) { setNotice(readableError(error)); }
    finally { setBusyId(null); }
  }

  async function decideKyc(item: KycQueueItem, decision: 'approve' | 'reject') {
    const client = getAdminSupabaseClient();
    if (!client) return;
    const reasonCode = decision === 'reject' ? window.prompt('Mã lý do audit:', 'document_mismatch')?.trim() || null : null;
    if (decision === 'reject' && !reasonCode) return;
    const expiresAt = decision === 'approve' ? window.prompt('Ngày hết hạn ISO (để trống nếu không áp dụng):', '')?.trim() || null : null;
    setBusyId(item.kyc_profile_id);
    try {
      await decideKycReview(client, { kycProfileId: item.kyc_profile_id, decision, reasonCode, expiresAt });
      setNotice(`KYC: ${decision === 'approve' ? 'đã duyệt' : 'đã từ chối'}.`); reload();
    } catch (error) { setNotice(readableError(error)); }
    finally { setBusyId(null); }
  }

  async function decideBank(item: BankQueueItem, decision: 'verify' | 'reject' | 'disable') {
    const client = getAdminSupabaseClient();
    if (!client) return;
    const reasonCode = decision === 'reject' ? window.prompt('Mã lý do audit:', 'account_mismatch')?.trim() || null : null;
    if (decision === 'reject' && !reasonCode) return;
    setBusyId(item.bank_account_id);
    try {
      await decideBankReview(client, { bankAccountId: item.bank_account_id, decision, reasonCode });
      setNotice(`Tài khoản ngân hàng: ${payoutStatusLabel(decision === 'verify' ? 'verified' : decision === 'reject' ? 'rejected' : 'disabled')}.`); reload();
    } catch (error) { setNotice(readableError(error)); }
    finally { setBusyId(null); }
  }

  async function operate(
    item: WithdrawalQueueItem,
    operation: WithdrawalOperation,
    payment?: { reference: string; evidenceSha256: string },
  ) {
    const client = getAdminSupabaseClient();
    if (!client) return;
    let reasonCode: string | null = null;
    let paymentReference: string | null = null;
    let paymentEvidenceSha256: string | null = null;
    if (operation === 'reject') {
      reasonCode = window.prompt('Mã lý do audit:', 'compliance_rejected')?.trim() || null;
      if (!reasonCode) return;
    }
    if (operation === 'mark_paid') {
      paymentReference = payment?.reference.trim() || null;
      paymentEvidenceSha256 = payment?.evidenceSha256.trim().toLowerCase() || null;
      if (!paymentReference || !paymentEvidenceSha256 || !/^[0-9a-f]{64}$/u.test(paymentEvidenceSha256)) {
        setNotice('Cần mã giao dịch và SHA-256 chứng từ gồm đúng 64 ký tự hex.');
        return;
      }
    }
    if (!window.confirm(`Xác nhận ${operation}? Thao tác được ghi audit và không thể bỏ qua maker–checker.`)) return;
    setBusyId(item.withdrawal_id);
    setNotice(null);
    try {
      await operateWithdrawal(client, { withdrawalId: item.withdrawal_id, operation, reasonCode, paymentReference, paymentEvidenceSha256 });
      setPaymentDraft(null);
      setNotice(`Withdrawal: ${operation}. Trạng thái đã được cập nhật từ server.`);
      reload();
    } catch (error) { setNotice(readableError(error)); }
    finally { setBusyId(null); }
  }

  return (
    <div className="adminModerationShell">
      <header className="adminModerationHeader">
        <div>
          <p className="adminEyebrow">OPT-13 · COMPLIANCE · FINANCE</p>
          <h1>KYC, ngân hàng và rút tiền</h1>
          <p>Control plane nối trực tiếp với OPT-12: user gửi yêu cầu → Finance nhận hồ sơ → duyệt → operator thứ hai xử lý → ghi nhận thanh toán kèm chứng từ.</p>
        </div>
        <div className="adminActions">
          <button className="adminSecondary" onClick={reload} type="button">Tải lại</button>
          <Link className="adminSecondary" href="/vietqr-reconciliation">VietQR</Link>
          <Link className="adminSecondary" href="/">Tài khoản</Link>
        </div>
      </header>

      <section className="adminFinanceNotice">
        <strong>Boundary bảo mật:</strong> OPT-13 mở operational flags cho Finance nhưng không cấp admin RPC cho app user. Payout vẫn bắt buộc role finance_admin/super_admin, maker–checker, mã giao dịch và SHA-256 chứng từ; mọi bước được audit ở server.
      </section>

      <section className="adminReconciliationQueue">
        <div className="adminSectionHeading">
          <div><p className="adminEyebrow">OPERATIONAL QUEUE</p><h2>{kinds.find((entry) => entry.value === kind)?.label}</h2></div>
          <div className="adminActions">
            {kinds.map((entry) => <button className={kind === entry.value ? 'adminPrimary' : 'adminSecondary'} key={entry.value} onClick={() => { setKind(entry.value); setFilter(''); setPaymentDraft(null); }} type="button">{entry.label}</button>)}
          </div>
          <label>Trạng thái<select onChange={(event) => setFilter(event.target.value)} value={filter}>{statusOptions[kind].map((status) => <option key={status || 'all'} value={status}>{status ? payoutStatusLabel(status) : 'Tất cả'}</option>)}</select></label>
        </div>
        <div className="adminSummaryStrip"><span>Tổng hồ sơ: <strong>{total}</strong></span><span>Đang hiển thị: <strong>{queue.items.length}</strong></span><span>Chế độ: <strong>Maker–checker</strong></span></div>
        {notice ? <div className="adminState adminCompactState" role="status">{notice}</div> : null}
        {queue.status === 'loading' && queue.items.length === 0 ? <div className="adminState">Đang tải…</div> : null}
        {queue.status === 'error' ? <div className="adminState adminError" role="alert"><strong>{queue.message}</strong><button className="adminSecondary" onClick={reload} type="button">Thử lại</button></div> : null}
        {queue.status === 'ready' && queue.items.length === 0 ? <div className="adminState"><strong>Không có hồ sơ</strong><p>Không có dữ liệu theo bộ lọc hiện tại.</p></div> : null}

        <div className="adminReconciliationList">
          {kind === 'kyc' ? (queue.items as KycQueueItem[]).map((item) => <article className="adminReconciliationCard" key={item.kyc_profile_id}>
            <header><div><strong>{item.display_name}</strong><small>{item.document_type ?? 'Chưa xác định'} · ****{item.document_number_last4 ?? '----'} · {item.country_code ?? '—'}</small></div><span data-status={item.status}>{payoutStatusLabel(item.status)}</span></header>
            <dl className="adminMetaGrid"><div><dt>Tài liệu</dt><dd>{item.document_count}</dd></div><div><dt>Tuổi hồ sơ</dt><dd>{item.age_minutes} phút</dd></div><div><dt>Reviewer</dt><dd>{item.assigned_to ?? 'Chưa nhận'}</dd></div><div><dt>SLA</dt><dd>{item.review_due_at ? new Date(item.review_due_at).toLocaleString('vi-VN') : '—'}</dd></div></dl>
            <div className="adminActions">
              {item.status === 'pending' && !item.assigned_to ? <button className="adminSecondary" disabled={busyId === item.kyc_profile_id} onClick={() => void claim(item)} type="button">Nhận hồ sơ</button> : null}
              {item.assigned_to && item.status === 'pending' ? <button className="adminSecondary" disabled={busyId === item.kyc_profile_id} onClick={() => void inspectKyc(item)} type="button">Xem PII/Tài liệu</button> : null}
              {item.assigned_to && item.status === 'pending' ? <button className="adminPrimary" disabled={busyId === item.kyc_profile_id} onClick={() => void decideKyc(item, 'approve')} type="button">Duyệt</button> : null}
              {item.assigned_to && item.status === 'pending' ? <button className="adminDanger" disabled={busyId === item.kyc_profile_id} onClick={() => void decideKyc(item, 'reject')} type="button">Từ chối</button> : null}
            </div>
          </article>) : null}

          {kind === 'bank' ? (queue.items as BankQueueItem[]).map((item) => <article className="adminReconciliationCard" key={item.bank_account_id}>
            <header><div><strong>{item.display_name}</strong><small>{item.bank_code} · ****{item.account_number_last4}</small></div><span data-status={item.status}>{payoutStatusLabel(item.status)}</span></header>
            <dl className="adminMetaGrid"><div><dt>Mặc định</dt><dd>{item.is_default ? 'Có' : 'Không'}</dd></div><div><dt>Tuổi hồ sơ</dt><dd>{item.age_minutes} phút</dd></div><div><dt>Reviewer</dt><dd>{item.assigned_to ?? 'Chưa nhận'}</dd></div><div><dt>SLA</dt><dd>{item.review_due_at ? new Date(item.review_due_at).toLocaleString('vi-VN') : '—'}</dd></div></dl>
            <div className="adminActions">
              {item.status === 'pending' && !item.assigned_to ? <button className="adminSecondary" disabled={busyId === item.bank_account_id} onClick={() => void claim(item)} type="button">Nhận hồ sơ</button> : null}
              {item.status === 'pending' && item.assigned_to ? <button className="adminSecondary" disabled={busyId === item.bank_account_id} onClick={() => void inspectBank(item)} type="button">Xem PII</button> : null}
              {item.status === 'pending' && item.assigned_to ? <button className="adminPrimary" disabled={busyId === item.bank_account_id} onClick={() => void decideBank(item, 'verify')} type="button">Xác minh</button> : null}
              {item.status === 'pending' && item.assigned_to ? <button className="adminDanger" disabled={busyId === item.bank_account_id} onClick={() => void decideBank(item, 'reject')} type="button">Từ chối</button> : null}
              {item.status === 'verified' ? <button className="adminSecondary" disabled={busyId === item.bank_account_id} onClick={() => void decideBank(item, 'disable')} type="button">Vô hiệu hóa</button> : null}
            </div>
          </article>) : null}

          {kind === 'withdrawal' ? (queue.items as WithdrawalQueueItem[]).map((item) => {
            const operations = withdrawalOperationsForStatus(item.status);
            const editingPayment = paymentDraft?.withdrawalId === item.withdrawal_id;
            return <article className="adminReconciliationCard" data-testid={`admin-withdrawal-${item.withdrawal_id}`} key={item.withdrawal_id}>
              <header><div><strong>{formatVnd(item.amount_vnd)}</strong><small>{item.display_name} · {item.requested_reward_units} units · {item.bank_code} ****{item.bank_last4}</small></div><span data-status={item.status}>{payoutStatusLabel(item.status)}</span></header>
              <dl className="adminMetaGrid">
                <div><dt>Yêu cầu</dt><dd>{new Date(item.requested_at).toLocaleString('vi-VN')}</dd></div>
                <div><dt>Reviewer</dt><dd>{item.assigned_to ?? 'Chưa nhận'}</dd></div>
                <div><dt>Người duyệt</dt><dd>{item.approved_by ?? '—'}</dd></div>
                <div><dt>Người xử lý</dt><dd>{item.processing_started_by ?? '—'}</dd></div>
                <div><dt>SLA</dt><dd>{item.review_due_at ? new Date(item.review_due_at).toLocaleString('vi-VN') : '—'}</dd></div>
                <div><dt>Tuổi hồ sơ</dt><dd>{item.age_minutes} phút</dd></div>
                <div><dt>Mã thanh toán</dt><dd>{item.payment_reference ?? '—'}</dd></div>
                <div><dt>Chứng từ</dt><dd>{item.payment_evidence_present ? 'Đã có' : 'Chưa có'}</dd></div>
              </dl>
              <p className="adminWorkflowHint"><strong>Bước tiếp theo:</strong> {withdrawalNextStepLabel(item.status)}</p>
              <div className="adminActions">
                {item.status === 'pending' ? <button className="adminSecondary" disabled={busyId === item.withdrawal_id} onClick={() => void claim(item)} type="button">Nhận hồ sơ</button> : null}
                {operations.includes('approve') ? <button className="adminPrimary" disabled={busyId === item.withdrawal_id} onClick={() => void operate(item, 'approve')} type="button">Duyệt</button> : null}
                {operations.includes('start_processing') ? <button className="adminSecondary" disabled={busyId === item.withdrawal_id} onClick={() => void operate(item, 'start_processing')} type="button">Bắt đầu chuyển tiền</button> : null}
                {operations.includes('mark_paid') ? <button className="adminPrimary" disabled={busyId === item.withdrawal_id} onClick={() => setPaymentDraft(editingPayment ? null : { withdrawalId: item.withdrawal_id, reference: '', evidenceSha256: '' })} type="button">Ghi nhận đã trả</button> : null}
                {operations.includes('reject') ? <button className="adminDanger" disabled={busyId === item.withdrawal_id} onClick={() => void operate(item, 'reject')} type="button">Từ chối</button> : null}
              </div>
              {editingPayment && paymentDraft ? (
                <div className="adminPayoutForm" data-testid="admin-withdrawal-payment-form">
                  <label>Mã giao dịch ngân hàng<input autoComplete="off" maxLength={120} onChange={(event) => setPaymentDraft({ ...paymentDraft, reference: event.target.value })} placeholder="VD: VCB-20260828-001" value={paymentDraft.reference} /></label>
                  <label>SHA-256 chứng từ<input autoComplete="off" maxLength={64} onChange={(event) => setPaymentDraft({ ...paymentDraft, evidenceSha256: event.target.value })} placeholder="64 ký tự hex" value={paymentDraft.evidenceSha256} /></label>
                  <div className="adminActions">
                    <button className="adminPrimary" disabled={busyId === item.withdrawal_id || !paymentDraft.reference.trim() || !/^[0-9a-f]{64}$/iu.test(paymentDraft.evidenceSha256.trim())} onClick={() => void operate(item, 'mark_paid', paymentDraft)} type="button">Xác nhận đã thanh toán</button>
                    <button className="adminSecondary" disabled={busyId === item.withdrawal_id} onClick={() => setPaymentDraft(null)} type="button">Đóng</button>
                  </div>
                </div>
              ) : null}
            </article>;
          }) : null}
        </div>
      </section>
    </div>
  );
}
