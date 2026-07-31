import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MyFan — Social Creator 18+',
    short_name: 'MyFan',
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
