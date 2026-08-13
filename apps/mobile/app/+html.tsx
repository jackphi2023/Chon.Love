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
          content="Luxy.Love là nền tảng hẹn hò dành cho người trưởng thành có định hướng, ưu tiên kết nối chất lượng, quyền riêng tư và trải nghiệm an toàn."
        />
        <meta name="theme-color" content="#081726" />
        <title>Luxy.Love — Hẹn hò cho người thật và thành đạt</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
