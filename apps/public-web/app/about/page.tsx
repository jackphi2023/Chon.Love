import type { Metadata } from 'next';
import { MarketingPage } from '../marketing-page';

export const metadata: Metadata = {
  title: 'Về Luxy.Love',
  description: 'Tìm hiểu cách Luxy.Love xây dựng một nền tảng kết nối chọn lọc dành cho người trưởng thành, ưu tiên xác thực, riêng tư và an toàn.',
  alternates: { canonical: '/about' },
  openGraph: { title: 'Về Luxy.Love', description: 'Kết nối chọn lọc với hồ sơ xác thực, quyền riêng tư và công cụ an toàn.', type: 'website' },
};

export default function AboutPage() {
  return <MarketingPage eyebrow="VỀ LUXY.LOVE" title="Kết nối chọn lọc, minh bạch hơn" lead="Luxy.Love được xây dựng cho người từ đủ 18 tuổi muốn tìm kiếm và kết nối trong một môi trường rõ ràng hơn về hồ sơ, quyền truy cập và an toàn." sections={[
    { title: 'Tập trung vào chất lượng hồ sơ', body: 'Trải nghiệm ưu tiên hồ sơ đầy đủ, tìm kiếm theo tiêu chí và các lớp xác thực thay vì cơ chế lướt nhanh tạo nhiễu.' },
    { title: 'Quyền riêng tư là mặc định', body: 'Ngày sinh đầy đủ, tọa độ chính xác, tài liệu xác minh và dữ liệu kiểm duyệt không được coi là dữ liệu hồ sơ công khai.' },
    { title: 'Quyền lợi trả phí được công bố rõ', body: 'Premium và Diamond mở các quyền sản phẩm cụ thể. Việc trả phí không mua quyền gặp mặt, tình cảm, phản hồi hay thông tin liên hệ riêng.' },
  ]} cta={{ title: 'Khám phá Luxy.Love', body: 'Tạo hồ sơ và bắt đầu với các công cụ tìm kiếm, xác thực và an toàn.', label: 'Tham gia', href: '/?intent=signup' }} />;
}
