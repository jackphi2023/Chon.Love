import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

type RootHtmlProps = {
  children: ReactNode;
};

export default function RootHtml({ children }: RootHtmlProps) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover"
        />
        <meta
          name="description"
          content="Chon.Love là nền tảng hẹn hò dành cho người dùng thật và văn minh, hướng tới các mối quan hệ lành mạnh, chất lượng và xứng tầm."
        />
        <meta name="theme-color" content="#081726" />
        <title>Chon.Love | Chọn đúng người, Yêu đúng Gu</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
