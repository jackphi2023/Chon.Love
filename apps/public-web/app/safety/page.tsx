import type { Metadata } from 'next';
import { MarketingPage } from '../marketing-page';

export const metadata: Metadata = {
  title: 'An toàn & quyền riêng tư',
  description: 'Nguyên tắc an toàn, xác thực, chặn, báo cáo và bảo vệ dữ liệu trên Luxy.Love.',
  alternates: { canonical: '/safety' },
};

export default function SafetyPage() {
  return <MarketingPage eyebrow="AN TOÀN & QUYỀN RIÊNG TƯ" title="Kiểm soát nhiều hơn trong từng kết nối" lead="Không hệ thống nào loại bỏ hoàn toàn rủi ro. Luxy.Love kết hợp xác thực, kiểm duyệt, chặn, báo cáo và phân tách dữ liệu để giảm rủi ro và giúp thành viên kiểm soát trải nghiệm." sections={[
    { title: 'Xác thực không đồng nghĩa bảo đảm', body: 'Badge cho biết một lớp kiểm tra đã được hoàn tất; không phải cam kết về ý định, tài chính hay hành vi tương lai của một người.' },
    { title: 'Chặn và báo cáo luôn được ưu tiên', body: 'Entitlement trả phí không được phép vượt qua block, moderation hold hoặc các giới hạn an toàn của nền tảng.' },
    { title: 'Bảo vệ dữ liệu nhạy cảm', body: 'Tọa độ chính xác, dữ liệu định danh, tài liệu xác minh và dữ liệu vận hành nội bộ được tách khỏi hồ sơ công khai và chỉ mở theo nhu cầu nghiệp vụ.' },
    { title: 'Gặp mặt an toàn', body: 'Khi gặp ngoài đời, hãy chọn nơi công cộng, tự chủ phương tiện di chuyển, thông báo cho người tin cậy và không gửi tiền theo yêu cầu từ người mới quen.' },
  ]} cta={{ title: 'Đọc quy tắc cộng đồng', body: 'Mọi thành viên đều phải tuân thủ tiêu chuẩn hành vi và nội dung của Luxy.Love.', label: 'Tiêu chuẩn cộng đồng', href: '/community-standards' }} />;
}
