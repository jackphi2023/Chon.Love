'use client';

import {
  createRuntimeEventId,
  normalizeRuntimeError,
  recordRuntimeObservation,
} from '@myfan/supabase';
import { useEffect, useRef } from 'react';
import { getAdminSupabaseClient } from '../src/lib/supabase';

function releaseChannel(): 'development' | 'staging' | 'beta' | 'production' {
  const value = process.env.NEXT_PUBLIC_MYFAN_ENV;
  return value === 'production' || value === 'staging' ? value : value === 'beta' ? 'beta' : 'development';
}

export default function AdminError({ error, reset }: { readonly error: Error & { digest?: string }; readonly reset: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    const client = getAdminSupabaseClient();
    if (!client) return;
    const normalized = normalizeRuntimeError(error);
    void recordRuntimeObservation(client, {
      eventId: createRuntimeEventId(),
      eventName: 'app_render_error',
      severity: 'error',
      platform: 'admin_web',
      releaseChannel: releaseChannel(),
      routeGroup: 'admin_root',
      errorCode: normalized.errorCode,
      metadata: { component: 'admin_error_boundary', retryable: normalized.retryable },
    }).catch(() => undefined);
  }, [error]);

  return (
    <main className="adminPage adminLoginPage">
      <section aria-labelledby="admin-error-title" className="adminCard" role="alert">
        <p className="adminEyebrow">RESILIENCE · BR-09</p>
        <h1 id="admin-error-title" ref={headingRef} tabIndex={-1}>Admin chưa thể tải</h1>
        <p>Vui lòng thử lại. Nhật ký chỉ ghi mã lỗi đã chuẩn hóa, không ghi PII, token, nội dung chat, KYC hoặc dữ liệu ngân hàng.</p>
        <button className="adminPrimary" onClick={reset} type="button">Thử lại</button>
      </section>
    </main>
  );
}
