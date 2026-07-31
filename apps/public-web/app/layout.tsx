import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import './site-shell.css';

export const metadata: Metadata = {
  title: {
    default: 'MyFan — Cộng đồng Creator và người hâm mộ',
    template: '%s · MyFan',
  },
  description: 'MyFan là mạng xã hội Social Creator dành cho người dùng từ 18 tuổi trở lên.',
  applicationName: 'MyFan',
  creator: 'MyFan',
  robots: { index: true, follow: true },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#FFF9F6',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <header className="publicHeader">
          <Link className="publicBrand" href="/" aria-label="MyFan trang chủ">
            <span aria-hidden="true">♥</span>
            <strong>MyFan</strong>
          </Link>

          <nav className="publicDesktopNav" aria-label="Điều hướng chính">
            <Link href="/">Trang chủ</Link>
            <Link href="/qua-tang">Quà tặng</Link>
            <Link href="/community-standards">Tiêu chuẩn cộng đồng</Link>
          </nav>

          <div className="publicHeaderActions">
            <Link className="publicLogin" href="/?intent=login">
              Đăng nhập
            </Link>
            <Link className="publicJoin" href="/?intent=signup">
              Tham gia
            </Link>
          </div>

          <details className="publicMobileMenu">
            <summary aria-label="Mở menu điều hướng">
              <span aria-hidden="true">☰</span>
            </summary>
            <nav aria-label="Điều hướng mobile">
              <Link href="/">Trang chủ</Link>
              <Link href="/qua-tang">Quà tặng</Link>
              <Link href="/community-standards">Tiêu chuẩn cộng đồng</Link>
              <Link href="/?intent=login">Đăng nhập</Link>
              <Link className="publicMobileJoin" href="/?intent=signup">
                Tham gia MyFan
              </Link>
            </nav>
          </details>
        </header>

        {children}

        <footer className="publicFooter">
          <div>
            <Link className="publicFooterBrand" href="/">
              MyFan
            </Link>
            <span>Social Creator · 18+</span>
          </div>
          <nav aria-label="Chính sách">
            <Link href="/terms">Điều khoản</Link>
            <span aria-hidden="true">·</span>
            <Link href="/community-standards">Tiêu chuẩn cộng đồng</Link>
          </nav>
          <small>© 2026 MyFan</small>
        </footer>
      </body>
    </html>
  );
}
