import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Luxy.Love — Kết nối chọn lọc 18+',
    short_name: 'Luxy.Love',
    description: 'Cộng đồng của nhà sáng tạo và người hâm mộ.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF9F6',
    theme_color: '#FF2E63',
    lang: 'vi',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
