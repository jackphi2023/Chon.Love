'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getAdminSupabaseClient, isCurrentUserSuperAdmin } from '../src/lib/supabase';

function normalizeAdminPath(pathname: string): string {
  const withoutBasePath = pathname === '/admin'
    ? '/'
    : pathname.startsWith('/admin/')
      ? pathname.slice('/admin'.length)
      : pathname;
  const withoutTrailingSlash = withoutBasePath.replace(/\/+$/u, '');
  return withoutTrailingSlash || '/';
}

function isPublicAdminPath(pathname: string): boolean {
  const normalized = normalizeAdminPath(pathname);
  return normalized === '/' || normalized === '/login';
}

export function AdminRouteGuard({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = useMemo(() => isPublicAdminPath(pathname), [pathname]);

  // Always fail closed on the prerendered/static HTML. Authorization is decided
  // only after the isolated Admin Supabase session and live super_admin role have
  // been checked in the browser. This prevents protected page content from being
  // exposed when Admin JS fails to hydrate or a member session exists on the site.
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    setAllowed(false);
    setChecking(true);

    const client = getAdminSupabaseClient();
    if (!client) {
      if (isPublicRoute) {
        setAllowed(true);
        setChecking(false);
      } else {
        router.replace('/login');
      }
      return () => { active = false; };
    }
    const supabase = client;

    async function checkAccess() {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !userData.user) {
        if (isPublicRoute) {
          setAllowed(true);
          setChecking(false);
        } else {
          router.replace('/login');
        }
        return;
      }

      const isSuperAdmin = await isCurrentUserSuperAdmin(supabase);
      if (!active) return;

      if (!isSuperAdmin) {
        // This signs out only the isolated Admin storage key; the normal Chọn.Love
        // member session is intentionally separate and must not be inherited here.
        await supabase.auth.signOut({ scope: 'local' });
        if (!active) return;
        if (isPublicRoute) {
          setAllowed(true);
          setChecking(false);
        } else {
          router.replace('/login');
        }
        return;
      }

      if (isPublicRoute) {
        router.replace('/dashboard');
        return;
      }

      setAllowed(true);
      setChecking(false);
    }

    void checkAccess();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === 'SIGNED_OUT' && !isPublicRoute) {
        setAllowed(false);
        setChecking(true);
        router.replace('/login');
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [isPublicRoute, pathname, router]);

  if (checking || !allowed) {
    return (
      <main className="adminPage adminGatePage" data-testid="admin-access-gate">
        <div className="adminCard adminGateCard">
          <span className="adminGateSpinner" aria-hidden="true" />
          <p>Đang kiểm tra quyền Super Admin…</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
