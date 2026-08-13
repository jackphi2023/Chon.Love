import type { Metadata } from 'next';
import { MarketingPage } from '../marketing-page';

export const metadata: Metadata = {
  title: 'Xóa tài khoản',
  description: 'Hướng dẫn gửi yêu cầu xóa tài khoản Chon.Love và dữ liệu liên quan.',
  alternates: { canonical: '/account-deletion' },
};

export default function Page() {
  return <MarketingPage eyebrow="TÀI KHOẢN & DỮ LIỆU" title="Yêu cầu xóa tài khoản" lead="Bạn có thể bắt đầu quy trình xóa tài khoản Chon.Love từ ứng dụng sau khi đăng nhập. Nếu không thể truy cập tài khoản, hãy liên hệ kênh hỗ trợ chính thức để được xác minh và xử lý." sections={[
    { title: 'Trước khi yêu cầu xóa', body: 'Hãy kiểm tra các gói đang hoạt động, giao dịch đang xử lý và lưu lại thông tin bạn còn cần. Việc xóa tài khoản có thể làm mất quyền truy cập vào hồ sơ và lịch sử sử dụng.' },
    { title: 'Dữ liệu được xử lý thế nào', body: 'Hồ sơ sẽ được vô hiệu hóa khỏi trải nghiệm thành viên. Một số dữ liệu có thể cần được giữ trong thời hạn hợp lý để đáp ứng nghĩa vụ pháp lý, chống gian lận, xử lý tranh chấp hoặc bảo đảm an toàn.' },
    { title: 'Không chia sẻ mật khẩu', body: 'Chon.Love không yêu cầu bạn gửi mật khẩu qua email hoặc biểu mẫu hỗ trợ. Việc xác minh yêu cầu phải sử dụng cơ chế tài khoản hoặc quy trình hỗ trợ chính thức.' },
  ]} cta={{ title: 'Đã có tài khoản?', body: 'Đăng nhập để quản lý tài khoản và bắt đầu yêu cầu xóa theo luồng bảo mật.', label: 'Đăng nhập', href: '/?intent=login' }} />;
}
