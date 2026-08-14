import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { getPublicAppUrl, getPublicSiteUrl } from '../src/lib/environment';
import './globals.css';
import './site-shell.css';
import './marketing.css';

const siteUrl = getPublicSiteUrl();
const appUrl = getPublicAppUrl();
const searchUrl = appUrl;
const favoritesUrl = `${appUrl}/favorites`;
const messagesUrl = `${appUrl}/messages`;
const loginUrl = `${appUrl}/auth?mode=login`;
const signupUrl = `${appUrl}/auth`;
const productionIndexable = !process.env.CONTEXT || process.env.CONTEXT === 'production';
const description = 'Chon.Love là nền tảng hẹn hò dành cho người dùng thật và văn minh, hướng tới các mối quan hệ lành mạnh, chất lượng và xứng tầm.';

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: { default: 'Chon.Love | Chọn đúng người, Yêu đúng Gu', template: '%s | Chon.Love' },
  description,
  applicationName: 'Chon.Love',
  creator: 'Chon.Love',
  robots: productionIndexable ? { index: true, follow: true } : { index: false, follow: false, noarchive: true },
  icons: { icon: '/icon.png' },
  openGraph: { siteName: 'Chon.Love', title: 'Chon.Love | Chọn đúng người, Yêu đúng Gu', description, locale: 'vi_VN', type: 'website' },
  twitter: { card: 'summary', title: 'Chon.Love | Chọn đúng người, Yêu đúng Gu', description },
};
export const viewport: Viewport = { colorScheme: 'light', themeColor: '#FFF9F6', width: 'device-width', initialScale: 1 };
const organizationData = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Chon.Love', slogan: 'Chọn đúng người, Yêu đúng Gu', ...(siteUrl ? { url: siteUrl } : {}), description };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }} />
    <a className="skipLink" href="#main-content">Bỏ qua đến nội dung chính</a>
    <header className="publicHeader">
      <Link className="publicBrand" href="/" aria-label="Chon.Love trang chủ"><span aria-hidden="true">♥</span><strong>Chon.Love</strong></Link>
      <nav className="publicDesktopNav" aria-label="Điều hướng chính">
        <a href={searchUrl}><span className="publicNavIcon" aria-hidden="true">⌕</span>Tìm kiếm</a>
        <a href={favoritesUrl}><span className="publicNavIcon" aria-hidden="true">♥</span>Yêu thích</a>
        <a href={messagesUrl}><span className="publicNavIcon" aria-hidden="true">✉</span>Tin nhắn</a>
      </nav>
      <div className="publicHeaderActions"><a className="publicLogin" href={loginUrl}>Đăng nhập</a><a className="publicJoin" href={signupUrl}>Tham gia</a></div>
      <details className="publicMobileMenu"><summary aria-label="Mở menu điều hướng"><span aria-hidden="true">☰</span></summary><nav aria-label="Điều hướng mobile"><Link href="/about">Về Chon.Love</Link><Link href="/how-it-works">Cách hoạt động</Link><Link href="/safety">An toàn</Link><Link href="/premium">Premium</Link><Link href="/diamond">Diamond</Link><Link href="/community-standards">Tiêu chuẩn cộng đồng</Link><a href={loginUrl}>Đăng nhập</a><a className="publicMobileJoin" href={signupUrl}>Tham gia Chon.Love</a></nav></details>
    </header>
    <div id="main-content" tabIndex={-1}>{children}</div>
    <footer className="publicFooter"><div><Link className="publicFooterBrand" href="/">Chon.Love</Link><span>Chọn đúng người, Yêu đúng Gu · 18+</span></div><nav aria-label="Chính sách"><Link href="/about">Giới thiệu</Link><span aria-hidden="true">–</span><Link href="/privacy">Quyền riêng tư</Link><span aria-hidden="true">–</span><Link href="/terms">Điều khoản</Link><span aria-hidden="true">–</span><Link href="/community-standards">Tiêu chuẩn cộng đồng</Link></nav><small>© 2026 · Hẹn hò văn minh & nghiêm túc</small></footer>
  </body></html>;
}