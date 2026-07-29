import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MyFan Admin',
  description: 'MyFan moderation and operations administration.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
