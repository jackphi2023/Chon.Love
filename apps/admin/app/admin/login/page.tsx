import type { Metadata } from 'next';
import { AdminLogin } from '../../admin-login';

export const metadata: Metadata = {
  title: 'Đăng nhập Admin · Luxy.Love',
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminLoginPage() {
  return (
    <main className="adminPage adminLoginPage">
      <AdminLogin />
    </main>
  );
}
