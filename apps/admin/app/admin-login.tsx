'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAdminSupabaseClient, isCurrentUserSuperAdmin } from '../src/lib/supabase';

export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = getAdminSupabaseClient();
    if (!client) return;

    let active = true;
    void client.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;
      if (await isCurrentUserSuperAdmin(client)) {
        router.replace('/dashboard');
      } else {
        // Admin uses a dedicated browser storage key. Never invalidate a normal
        // member session just because that member visited the Admin login page.
        await client.auth.signOut({ scope: 'local' });
      }
    });

    return () => {
      active = false;
    };
  }, [router]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getAdminSupabaseClient();
    if (!client) {
      setMessage('Supabase Admin chưa được cấu hình.');
      return;
    }

    setBusy(true);
    setMessage(null);

    const { error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setBusy(false);
      setMessage('Không thể đăng nhập. Hãy kiểm tra tài khoản và mật khẩu.');
      return;
    }

    const isSuperAdmin = await isCurrentUserSuperAdmin(client);
    if (!isSuperAdmin) {
      await client.auth.signOut({ scope: 'local' });
      setBusy(false);
      setPassword('');
      setMessage('Tài khoản không có quyền Super Admin.');
      return;
    }

    router.replace('/dashboard');
  }

  return (
    <form className="adminCard adminLoginForm" onSubmit={signIn}>
      <p className="adminEyebrow">SECURE OPERATIONS · SUPER ADMIN</p>
      <h1>Chon.Love Admin</h1>
      <p id="admin-login-help">Khu vực quản trị dùng phiên đăng nhập riêng với tài khoản thành viên. Chỉ tài khoản có role Super Admin mới được truy cập.</p>
      <label htmlFor="admin-email">Email<input aria-describedby="admin-login-help" id="admin-email" autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
      <label htmlFor="admin-password">Mật khẩu<input aria-describedby="admin-login-help" id="admin-password" autoComplete="current-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
      {message ? <p className="adminError" role="alert">{message}</p> : null}
      <button aria-busy={busy} className="adminPrimary" disabled={busy} type="submit">{busy ? 'Đang xác minh quyền…' : 'Đăng nhập Admin'}</button>
    </form>
  );
}
