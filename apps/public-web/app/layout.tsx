import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { getPublicSiteUrl } from '../src/lib/environment';
import './globals.css';
import './site-shell.css';
import './marketing.css';

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: { default: 'Luxy.Love — Kết nối chọn lọc cho người trưởng thành', template: '%s · Luxy.Love' },
  description: 'Luxy.Love là nền tảng kết nối dành cho người từ đủ 18 tuổi, với hồ sơ xác thực, quyền riêng tư và công cụ an toàn.',
  applicationName: 'Luxy.Love',
  creator: 'Luxy.Love',
  robots: { index: true, follow: true },
  icons: { icon: '/icon.svg' },
  openGraph: { siteName: 'Luxy.Love', locale: 'vi_VN', type: 'website' },
};

export const viewport: Viewport = { colorScheme: 'light', themeColor: '#FFF9F6', width: 'device-width', initialScale: 1 };

const organizationData = {
  '@context': 'https://schema.org', '@type': 'Organization', name: 'Luxy.Love',
  ...(siteUrl ? { url: siteUrl } : {}),
  description: 'Nền tảng kết nối chọn lọc dành cho người từ đủ 18 tuổi.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi"><body>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }} />
      <a className="skipLink" href="#main-content">Bỏ qua đến nội dung chính</a>
      <header className="publicHeader">
        <Link className="publicBrand" href="/" aria-label="Luxy.Love trang chủ"><span aria-hidden="true">♥</span><strong>Luxy.Love</strong></Link>
        <nav className="publicDesktopNav" aria-label="Điều hướng chính">
          <Link href="/how-it-works">Cách hoạt động</Link><Link href="/safety">An toàn</Link><Link href="/premium">Premium</Link><Link href="/diamond">Diamond</Link>
        </nav>
        <div className="publicHeaderActions"><Link className="publicLogin" href="/?intent=login">Đăng nhập</Link><Link className="publicJoin" href="/?intent=signup">Tham gia</Link></div>
        <details className="publicMobileMenu"><summary aria-label="Mở menu điều hướng"><span aria-hidden="true">☰</span></summary><nav aria-label="Điều hướng mobile">
          <Link href="/about">Về Luxy.Love</Link><Link href="/how-it-works">Cách hoạt động</Link><Link href="/safety">An toàn</Link><Link href="/premium">Premium</Link><Link href="/diamond">Diamond</Link><Link href="/community-standards">Tiêu chuẩn cộng đồng</Link><Link href="/?intent=login">Đăng nhập</Link><Link className="publicMobileJoin" href="/?intent=signup">Tham gia Luxy.Love</Link>
        </nav></details>
      </header>
      <div id="main-content" tabIndex={-1}>{children}</div>
      <footer className="publicFooter"><div><Link className="publicFooterBrand" href="/">Luxy.Love</Link><span>Kết nối chọn lọc · 18+</span></div><nav aria-label="Chính sách"><Link href="/about">Giới thiệu</Link><span aria-hidden="true">–</span><Link href="/privacy">Quyền riêng tư</Link><span aria-hidden="true">–</span><Link href="/terms">Điều khoản</Link><span aria-hidden="true">–</span><Link href="/community-standards">Tiêu chuẩn cộng đồng</Link></nav><small>© 2026 Luxy.Love</small></footer>
    </body></html>
  );
}
