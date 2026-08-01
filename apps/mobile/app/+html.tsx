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
          content="MyFan là mạng xã hội Creator dành cho người dùng từ 18 tuổi, ưu tiên an toàn, quyền riêng tư và khả năng tiếp cận."
        />
        <title>MyFan — Mạng xã hội Creator 18+</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
