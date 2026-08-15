import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

const description = 'Chon.Love là nền tảng hẹn hò dành cho người dùng thật và văn minh, hướng tới các mối quan hệ lành mạnh, chất lượng và xứng tầm.';
const title = 'Chon.Love | Chọn đúng người, Yêu đúng Gu';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/' },
  openGraph: { title, description, locale: 'vi_VN', type: 'website' },
  twitter: { card: 'summary', title, description },
};

/**
 * The public and authenticated Netlify release embeds the Expo Web app under
 * `/app`. The Expo homepage is the single UI source of truth for Chon.Love.
 * Keep this route as a server-side fallback so an accidentally selected
 * public-web package can never expose the retired static homepage again.
 */
export default function Page() {
  redirect('/app/');
}
