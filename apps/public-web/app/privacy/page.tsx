import type { Metadata } from 'next';
import { MarketingPage } from '../marketing-page';

export const metadata: Metadata = {
  title: 'Chính sách quyền riêng tư',
  description: 'Cách Luxy.Love xử lý dữ liệu tài khoản, hồ sơ, vị trí, xác thực, thanh toán và yêu cầu xóa tài khoản.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return <MarketingPage eyebrow="QUYỀN RIÊNG TƯ" title="Dữ liệu được dùng theo mục đích rõ ràng" lead="Luxy.Love chỉ nên thu thập và xử lý dữ liệu cần thiết để cung cấp dịch vụ, bảo vệ thành viên, vận hành thanh toán và đáp ứng nghĩa vụ pháp lý." sections={[
    { title: 'Dữ liệu tài khoản và hồ sơ', body: 'Thông tin đăng nhập, trường hồ sơ, tùy chọn khám phá và nội dung do bạn cung cấp được dùng để tạo tài khoản và vận hành trải nghiệm kết nối.' },
    { title: 'Vị trí và dữ liệu nhạy cảm', body: 'Tọa độ chính xác, ngày sinh đầy đủ và tài liệu xác minh được tách khỏi dữ liệu hồ sơ công khai. Giao diện thành viên khác chỉ nhận dữ liệu dẫn xuất cần thiết như khoảng cách.' },
    { title: 'Xác thực và an toàn', body: 'Selfie, tài liệu danh tính, báo cáo và thông tin kiểm duyệt được sử dụng cho mục đích xác minh, chống lạm dụng và xử lý khiếu nại.' },
    { title: 'Thanh toán và vận hành', body: 'Mã đơn, số tiền, trạng thái đối soát và tham chiếu giao dịch được lưu để cấp entitlement, hỗ trợ người dùng và phục vụ audit. Luxy.Love không hiển thị dữ liệu thanh toán nhạy cảm trên hồ sơ.' },
    { title: 'Xóa tài khoản', body: 'Bạn có thể gửi yêu cầu xóa tài khoản theo luồng được cung cấp. Một số dữ liệu có thể cần được giữ trong thời gian hợp lý khi có nghĩa vụ pháp lý, tranh chấp hoặc yêu cầu chống gian lận.' },
  ]} cta={{ title: 'Yêu cầu xóa tài khoản', body: 'Sử dụng trang xóa tài khoản để bắt đầu quy trình và xem hướng dẫn áp dụng.', label: 'Xóa tài khoản', href: '/account-deletion' }} />;
}
