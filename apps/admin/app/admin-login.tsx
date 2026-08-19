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
        await client.auth.signOut();
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
      email: email.trim(),
      password,
    });

    if (error) {
      setBusy(false);
      setMessage('Không thể đăng nhập. Hãy kiểm tra tài khoản và mật khẩu.');
      return;
    }

    const isSuperAdmin = await isCurrentUserSuperAdmin(client);
    if (!isSuperAdmin) {
      await client.auth.signOut();
      setBusy(false);
      setMessage('Tài khoản không có quyền Super Admin.');
      return;
    }

    router.replace('/dashboard');
  }

  return (
    <form className="adminCard adminLoginForm" onSubmit={signIn}>
      <p className="adminEyebrow">MODERATION · FINANCE · 18+</p>
      <h1>Chon.Love Admin</h1>
      <p id="admin-login-help">Chỉ tài khoản được cấp quyền Super Admin mới có thể truy cập khu vực quản trị. Các thao tác nhạy cảm tiếp tục được kiểm tra quyền ở backend và ghi audit.</p>
      <label htmlFor="admin-email">Email<input aria-describedby="admin-login-help" id="admin-email" autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
      <label htmlFor="admin-password">Mật khẩu<input aria-describedby="admin-login-help" id="admin-password" autoComplete="current-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
      {message ? <p className="adminError" role="alert">{message}</p> : null}
      <button aria-busy={busy} className="adminPrimary" disabled={busy} type="submit">{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
    </form>
  );
}
