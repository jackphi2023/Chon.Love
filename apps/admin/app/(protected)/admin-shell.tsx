'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getAdminSupabaseClient } from '../../src/lib/supabase';

const links = [
  ['Dashboard', '/dashboard'],
  ['Homepage', '/homepage'],
  ['Users', '/users'],
  ['Xác minh ảnh', '/member-verifications'],
  ['Gói thành viên', '/memberships'],
  ['Đối soát VietQR', '/vietqr-reconciliation'],
  ['KYC & rút tiền', '/withdrawals'],
  ['Moderation', '/moderation'],
  ['Observability', '/runtime-observability'],
] as const;

function normalizePath(pathname: string): string {
  const path = pathname.startsWith('/admin/') ? pathname.slice('/admin'.length) : pathname;
  return path.replace(/\/+$/u, '') || '/';
}

export function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const normalizedPath = useMemo(() => normalizePath(pathname), [pathname]);
  const [email, setEmail] = useState<string>('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const client = getAdminSupabaseClient();
    if (!client) return;
    let active = true;
    void client.auth.getUser().then(({ data }) => {
      if (active) setEmail(data.user?.email ?? '');
    });
    return () => { active = false; };
  }, []);

  async function signOut() {
    const client = getAdminSupabaseClient();
    if (!client) {
      router.replace('/login');
      return;
    }
    setSigningOut(true);
    await client.auth.signOut({ scope: 'local' });
    router.replace('/login');
  }

  return (
    <div className="adminShell">
      <aside className="adminSidebar">
        <div className="adminBrandBlock">
          <span className="adminBrandMark">C</span>
          <div>
            <strong>Chon.Love Admin</strong>
            <small>Super Admin Console</small>
          </div>
        </div>

        <nav aria-label="Admin navigation" className="adminNav">
          {links.map(([label, href]) => {
            const active = normalizedPath === href || normalizedPath.startsWith(`${href}/`);
            return (
              <Link aria-current={active ? 'page' : undefined} className={active ? 'adminNavLink isActive' : 'adminNavLink'} href={href} key={href}>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="adminAccountBlock">
          <span>Đăng nhập với</span>
          <strong title={email}>{email || 'Super Admin'}</strong>
          <button className="adminSecondary adminSignOut" disabled={signingOut} onClick={() => void signOut()} type="button">
            {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </div>
      </aside>

      <div className="adminWorkspace">
        <header className="adminTopbar">
          <div>
            <span className="adminTopbarLabel">CHỌN.LOVE · OPERATIONS</span>
            <strong>Khu vực quản trị</strong>
          </div>
          <span className="adminSecurityPill">SUPER ADMIN</span>
        </header>
        <main className="adminMain">{children}</main>
      </div>
    </div>
  );
}
