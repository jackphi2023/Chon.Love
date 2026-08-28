import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

type RootHtmlProps = { children: ReactNode };

const DESCRIPTION = 'Chon.Love là nền tảng hẹn hò dành cho người dùng thật và văn minh, hướng tới các mối quan hệ lành mạnh, chất lượng và xứng tầm';
const DEFAULT_TITLE = 'Trang chủ | Chọn.love - Chọn đúng Người, Yêu đúng Gu';
const DEFAULT_SOCIAL_IMAGE = 'https://www.chon.love/seo/chonlove-homepage-thumbnail.jpg';
const FAVICON_DATA_URI = 'data:image/png;base64,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';

function getSupabaseOrigin(): string | null {
  const configured = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

const SUPABASE_ORIGIN = getSupabaseOrigin();

export default function RootHtml({ children }: RootHtmlProps) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover" />
        <meta name="description" content={DESCRIPTION} />
        <meta name="theme-color" content="#081726" />
        <link rel="icon" type="image/png" sizes="64x64" href={FAVICON_DATA_URI} />
        <link rel="shortcut icon" type="image/png" href={FAVICON_DATA_URI} />
        {SUPABASE_ORIGIN ? <link rel="dns-prefetch" href={SUPABASE_ORIGIN} /> : null}
        {SUPABASE_ORIGIN ? <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" /> : null}
        <meta property="og:site_name" content="Chọn.love" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={DEFAULT_TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image" content={DEFAULT_SOCIAL_IMAGE} />
        <meta property="og:image:width" content="480" />
        <meta property="og:image:height" content="360" />
        <meta property="og:image:alt" content="Chọn.love - Chọn đúng Người, Yêu đúng Gu" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={DEFAULT_TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={DEFAULT_SOCIAL_IMAGE} />
        <title>{DEFAULT_TITLE}</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
