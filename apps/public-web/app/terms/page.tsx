import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng',
  description: 'Điều khoản sử dụng Luxy.Love dành cho người từ đủ 18 tuổi.',
  alternates: { canonical: '/terms' },
};

export default function Page() {
  return (
    <main className="legalPage">
      <article className="legalDocument">
        <p className="legalKicker">LUXY.LOVE · CẬP NHẬT NGÀY 13/08/2026</p>
        <h1>Điều khoản sử dụng</h1>
        <p className="legalLead">Điều khoản này quy định việc truy cập và sử dụng Luxy.Love, nền tảng kết nối chỉ dành cho người từ đủ 18 tuổi trở lên.</p>

        <h2>1. Điều kiện sử dụng</h2>
        <p>Bạn phải từ đủ 18 tuổi, cung cấp thông tin đăng ký chính xác, sử dụng hình ảnh thuộc quyền sử dụng hợp pháp của mình và tự chịu trách nhiệm bảo vệ tài khoản.</p>

        <h2>2. Mục đích của Luxy.Love</h2>
        <p>Luxy.Love giúp người trưởng thành tạo hồ sơ, khám phá thành viên phù hợp, thể hiện sự quan tâm và trò chuyện theo các quyền sản phẩm đang được mở.</p>
        <p>Luxy.Love không phải dịch vụ mại dâm, môi giới dịch vụ tình dục, chuyển tiền ngang hàng hoặc nền tảng mua bán gặp mặt, tình cảm, quan hệ tình dục hay thông tin liên hệ riêng.</p>

        <h2>3. Hồ sơ, xác thực và quyền riêng tư</h2>
        <p>Người dùng chịu trách nhiệm về thông tin và hình ảnh đã cung cấp. Nền tảng có thể yêu cầu selfie, kiểm tra hình ảnh hoặc tài liệu xác minh để bảo vệ tính xác thực của hồ sơ.</p>
        <p>Ngày sinh đầy đủ, tọa độ chính xác, dữ liệu xác minh, thông tin thanh toán và dữ liệu kiểm duyệt nội bộ không phải dữ liệu hồ sơ công khai. Quyền chặn luôn được ưu tiên hơn các entitlement khác.</p>

        <h2>4. Nhắn tin và ảnh riêng tư</h2>
        <p>Quyền bắt đầu hoặc gửi tin nhắn, cũng như quyền xem ảnh riêng tư, có thể phụ thuộc vào gói thành viên và trạng thái tài khoản. Không được spam, quấy rối, đe dọa, mạo danh hoặc tìm cách vượt qua quyền truy cập.</p>

        <h2>5. Gói thành viên và thanh toán</h2>
        <p>Các khoản thanh toán cho Premium hoặc Diamond là phí sử dụng tính năng nền tảng theo gói được công bố. Việc thanh toán không tạo nghĩa vụ gặp mặt, quan hệ cá nhân hay cung cấp thông tin liên hệ từ người dùng khác.</p>
        <p>Một số tính năng giao dịch hoặc quà tặng có thể chưa khả dụng trong phiên bản hiện tại và chỉ được mở khi đáp ứng điều kiện sản phẩm, vận hành và an toàn.</p>

        <h2>6. Nội dung và hành vi bị cấm</h2>
        <ul>
          <li>Nội dung tình dục, khỏa thân, dịch vụ tình dục hoặc nội dung nhằm kích dục.</li>
          <li>Bóc lột, dụ dỗ, xâm hại hoặc tình dục hóa người dưới 18 tuổi.</li>
          <li>Đổi tiền, quà hoặc lợi ích vật chất lấy gặp mặt, tình cảm, quan hệ tình dục hoặc nội dung người lớn.</li>
          <li>Quấy rối, theo dõi, đe dọa, mạo danh, lừa đảo hoặc thao túng tài chính.</li>
          <li>Đăng thông tin riêng tư của người khác khi chưa được phép.</li>
          <li>Tìm cách vượt qua kiểm duyệt, block, RLS hoặc các biện pháp an toàn.</li>
        </ul>

        <h2>7. Kiểm duyệt và xử lý vi phạm</h2>
        <p>Luxy.Love có thể hạn chế hiển thị, gỡ nội dung, hạn chế tính năng, đình chỉ hoặc vô hiệu tài khoản khi cần bảo vệ người dùng, điều tra vi phạm, tuân thủ pháp luật hoặc thực thi Tiêu chuẩn cộng đồng.</p>

        <h2>8. Báo cáo và chặn</h2>
        <p>Người dùng có thể báo cáo tài khoản, ảnh hoặc tin nhắn và có thể chặn tài khoản khác. Lạm dụng công cụ báo cáo hoặc trả đũa người báo cáo có thể bị xử lý.</p>

        <h2>9. Xóa tài khoản</h2>
        <p>Người dùng có thể gửi yêu cầu xóa tài khoản. Một số dữ liệu có thể được giữ trong thời hạn cần thiết để chống gian lận, xử lý nghĩa vụ pháp lý hoặc thực thi an toàn trước khi được xóa hoặc ẩn danh.</p>

        <h2>10. Thay đổi điều khoản</h2>
        <p>Luxy.Love có thể cập nhật Điều khoản khi sản phẩm, pháp luật hoặc yêu cầu vận hành thay đổi. Khi cần, người dùng sẽ được yêu cầu đọc và chấp nhận phiên bản mới.</p>

        <p className="legalUpdated">Việc tiếp tục sử dụng Luxy.Love sau khi Điều khoản có hiệu lực đồng nghĩa với việc bạn đồng ý tuân thủ Điều khoản và Tiêu chuẩn cộng đồng hiện hành.</p>
      </article>
    </main>
  );
}
