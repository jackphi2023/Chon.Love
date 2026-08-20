import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

type RootHtmlProps = { children: ReactNode };

const DESCRIPTION = 'Chon.Love là nền tảng hẹn hò dành cho người dùng thật và văn minh, hướng tới các mối quan hệ lành mạnh, chất lượng và xứng tầm';
const DEFAULT_TITLE = 'Trang chủ | Chọn.love - Chọn đúng Người, Yêu đúng Gu';
const DEFAULT_SOCIAL_IMAGE = 'https://www.chon.love/seo/chonlove-thumbnail.jpg';

export default function RootHtml({ children }: RootHtmlProps) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover" />
        <meta name="description" content={DESCRIPTION} />
        <meta name="theme-color" content="#081726" />
        <meta property="og:site_name" content="Chọn.love" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={DEFAULT_TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image" content={DEFAULT_SOCIAL_IMAGE} />
        <meta property="og:image:width" content="1448" />
        <meta property="og:image:height" content="1086" />
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