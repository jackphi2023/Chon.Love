'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAdminSupabaseClient, isCurrentUserSuperAdmin } from '../../src/lib/supabase';

export function ProtectedShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
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
        if (active) router.replace('/login?error=forbidden');
        return;
      }

      setAllowed(true);
      setChecking(false);
    }

    void checkAccess();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setAllowed(false);
        router.replace('/login');
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [router]);

  if (checking || !allowed) {
    return <main className="adminPage"><div className="adminCard"><p>Đang kiểm tra quyền quản trị…</p></div></main>;
  }

  return <>{children}</>;
}
