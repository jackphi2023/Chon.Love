'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getAdminSupabaseClient } from '../src/lib/supabase';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = getAdminSupabaseClient();
    if (!client) return;
    void client.auth.getUser().then(({ data }) => setSignedInEmail(data.user?.email ?? null));
    const { data } = client.auth.onAuthStateChange((_event, session) => setSignedInEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getAdminSupabaseClient();
    if (!client) {
      setMessage('Supabase Admin chưa được cấu hình.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMessage('Không thể đăng nhập. Hãy kiểm tra tài khoản và mật khẩu.');
  }

  async function signOut() {
    const client = getAdminSupabaseClient();
    if (!client) return;
    await client.auth.signOut();
  }

  if (signedInEmail) {
    return (
      <div className="adminCard">
        <p className="adminEyebrow">ĐÃ ĐĂNG NHẬP</p>
        <h1>MyFan Admin</h1>
        <p>Phiên hiện tại: <strong>{signedInEmail}</strong>. Mọi RPC nhạy cảm tiếp tục xác minh role tại database; giao diện không giữ service-role key.</p>
        <div className="adminActions">
          <Link className="adminPrimary" href="/activity-moderation">Kiểm duyệt Hoạt động</Link>
          <Link className="adminSecondary" href="/vietqr-reconciliation">Đối soát VietQR</Link>
          <button className="adminSecondary" onClick={() => void signOut()} type="button">Đăng xuất</button>
        </div>
      </div>
    );
  }

  return (
    <form className="adminCard adminLoginForm" onSubmit={signIn}>
      <p className="adminEyebrow">MODERATION · FINANCE · 18+</p>
      <h1>MyFan Admin</h1>
      <p>Đăng nhập bằng tài khoản được cấp role phù hợp. Đối soát VietQR yêu cầu finance_admin hoặc super_admin.</p>
      <label>Email<input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
      <label>Mật khẩu<input autoComplete="current-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
      {message ? <p className="adminError" role="alert">{message}</p> : null}
      <button className="adminPrimary" disabled={busy} type="submit">{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
    </form>
  );
}
