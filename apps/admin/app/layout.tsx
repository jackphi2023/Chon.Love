import type { Metadata } from 'next';
import './globals.css';
import './admin-shell.css';
import { AdminRouteGuard } from './admin-route-guard';

export const metadata: Metadata = {
  title: 'Chon.Love Admin',
  description: 'Chon.Love moderation and operations administration.',
  robots: { index: false, follow: false, noarchive: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <a className="skipLink" href="#main-content">Bỏ qua đến nội dung chính</a>
        <div id="main-content" tabIndex={-1}><AdminRouteGuard>{children}</AdminRouteGuard></div>
      </body>
    </html>
  );
}
