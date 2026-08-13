import type { Metadata } from 'next';
import './globals.css';

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
        <div id="main-content" tabIndex={-1}>{children}</div>
      </body>
    </html>
  );
}
