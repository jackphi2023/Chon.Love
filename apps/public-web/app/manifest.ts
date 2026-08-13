import type { MetadataRoute } from 'next';
export const dynamic = 'force-static';
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'Chon.Love | Chọn đúng người, Yêu đúng Gu', short_name: 'Chon.Love', description: 'Chon.Love là nền tảng hẹn hò dành cho người dùng thật và văn minh, hướng tới các mối quan hệ lành mạnh, chất lượng và xứng tầm.', start_url: '/', display: 'standalone', background_color: '#FFF9F6', theme_color: '#C81C1D', lang: 'vi', icons: [{ src: '/chonlove-favicon.png', sizes: '128x128', type: 'image/png', purpose: 'any' }] };
}
