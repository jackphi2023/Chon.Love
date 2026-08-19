'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getAdminSupabaseClient, isCurrentUserSuperAdmin } from '../src/lib/supabase';

const PUBLIC_ADMIN_PATHS = new Set([
  '/',
  '/login',
  '/login/',
  '/admin',
  '/admin/',
  '/admin/login',
  '/admin/login/',
]);

export function AdminRouteGuard({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = useMemo(() => PUBLIC_ADMIN_PATHS.has(pathname), [pathname]);
  const [allowed, setAllowed] = useState(isPublicRoute);
  const [checking, setChecking] = useState(!isPublicRoute);

  useEffect(() => {
    if (isPublicRoute) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    setAllowed(false);
    setChecking(true);

    const client = getAdminSupabaseClient();
    if (!client) {
      router.replace('/login');
      return;
    }
    const supabase = client;
    let active = true;

    async function checkAccess() {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;

      if (!userData.user) {
        router.replace('/login');
        return;
      }

      const isSuperAdmin = await isCurrentUserSuperAdmin(supabase);
      if (!active) return;

      if (!isSuperAdmin) {
        await supabase.auth.signOut();
        if (active) router.replace('/login');
        return;
      }

      setAllowed(true);
      setChecking(false);
    }

    void checkAccess();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && active) {
        setAllowed(false);
        router.replace('/login');
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [isPublicRoute, router]);

  if (checking || !allowed) {
    return <main className="adminPage"><div className="adminCard"><p>Đang kiểm tra quyền quản trị…</p></div></main>;
  }

  return <>{children}</>;
}
