import Link from 'next/link';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MyFan — Social Creator 18+',
  description: 'Kết nối cộng đồng Creator và Fan với nội dung an toàn, được kiểm duyệt.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <header>
          <strong>MyFan</strong>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/community-standards">Community Standards</Link>
          <Link href="/child-safety">Child Safety</Link>
          <Link href="/account-deletion">Xóa tài khoản</Link>
        </header>
        <main>{children}</main>
        <footer>MyFan chỉ dành cho người dùng từ 18 tuổi trở lên.</footer>
      </body>
    </html>
  );
}
