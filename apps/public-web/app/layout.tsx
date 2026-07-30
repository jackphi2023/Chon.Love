import Link from 'next/link';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MyFan — Cộng đồng Creator và người hâm mộ',
  description: 'MyFan là mạng xã hội Social Creator dành cho người dùng từ 18 tuổi trở lên.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <header className="siteHeader">
          <Link className="brand" href="/" aria-label="MyFan trang chủ">MyFan</Link>
          <nav aria-label="Điều hướng chính">
            <Link href="/community-standards">Tiêu chuẩn cộng đồng</Link>
            <Link href="/privacy">Bảo mật</Link>
            <Link href="/terms">Điều khoản</Link>
            <Link href="/account-deletion">Xóa tài khoản</Link>
          </nav>
        </header>
        {children}
        <footer className="siteFooter">
          <span>MyFan · Social Creator 18+</span>
          <Link href="/child-safety">An toàn trẻ em</Link>
        </footer>
      </body>
    </html>
  );
}
