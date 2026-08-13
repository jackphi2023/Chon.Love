import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tiêu chuẩn cộng đồng',
  description: 'Tiêu chuẩn cộng đồng áp dụng cho hồ sơ, ảnh, tin nhắn và hành vi trên Luxy.Love.',
  alternates: { canonical: '/community-standards' },
};

export default function Page() {
  return (
    <main className="legalPage">
      <article className="legalDocument">
        <p className="legalKicker">LUXY.LOVE · CẬP NHẬT NGÀY 13/08/2026</p>
        <h1>Tiêu chuẩn cộng đồng</h1>
        <p className="legalLead">Tiêu chuẩn này áp dụng cho hồ sơ, ảnh, tin nhắn, liên kết và mọi nội dung hoặc hành vi trên Luxy.Love.</p>

        <h2>1. Chỉ dành cho người từ đủ 18 tuổi</h2>
        <p>Luxy.Love không cho phép người dưới 18 tuổi đăng ký hoặc sử dụng nền tảng. Cấm tuyệt đối nội dung hoặc hành vi bóc lột, dụ dỗ, xâm hại, tình dục hóa hoặc khai thác người dưới 18 tuổi.</p>

        <h2>2. Không cho phép nội dung tình dục hoặc bóc lột</h2>
        <ul>
          <li>Khỏa thân, hành vi tình dục hoặc nội dung khiêu dâm.</li>
          <li>Dịch vụ tình dục, mại dâm, môi giới hoặc quảng cáo liên quan.</li>
          <li>Hình ảnh thân mật không có sự đồng thuận, deepfake tình dục hoặc sextortion.</li>
          <li>Yêu cầu chuyển nội dung tình dục qua nền tảng khác.</li>
        </ul>

        <h2>3. Không mua bán quan hệ hoặc quyền tiếp cận</h2>
        <p>Không được đề nghị, yêu cầu hoặc ám chỉ rằng tiền, quà hoặc lợi ích vật chất sẽ được đổi lấy gặp mặt, tình cảm, quan hệ tình dục, thông tin liên hệ riêng, dịch vụ cá nhân hoặc nội dung người lớn.</p>

        <h2>4. Tôn trọng ranh giới</h2>
        <ul>
          <li>Không đe dọa, bắt nạt, làm nhục, ép buộc hoặc theo dõi người khác.</li>
          <li>Không tiếp tục liên hệ khi người nhận đã từ chối hoặc chặn.</li>
          <li>Không làm lộ thông tin cá nhân hoặc hình ảnh riêng tư của người khác.</li>
          <li>Không kích động thù ghét hoặc bạo lực.</li>
        </ul>

        <h2>5. Không lừa đảo hoặc mạo danh</h2>
        <p>Cấm giả danh cá nhân, nhân viên Luxy.Love hoặc tổ chức khác; tạo hồ sơ gây hiểu nhầm; lừa lấy tiền, tài khoản hoặc dữ liệu cá nhân; phát tán liên kết độc hại hoặc thao túng giao dịch.</p>

        <h2>6. Bảo vệ quyền riêng tư</h2>
        <p>Không đăng số điện thoại, địa chỉ, tọa độ chính xác, tài liệu định danh, tài khoản ngân hàng, nội dung riêng tư hoặc thông tin nhạy cảm của người khác khi chưa được phép.</p>
        <p>Không tìm cách suy luận vị trí chính xác, vượt qua quyền xem ảnh riêng tư hoặc chia sẻ lại nội dung riêng tư ngoài phạm vi được cấp quyền.</p>

        <h2>7. Hồ sơ và hình ảnh xác thực</h2>
        <p>Không dùng ảnh của người khác để giả danh. Ảnh mới có thể ở trạng thái chờ kiểm duyệt; selfie hoặc tài liệu xác minh có thể được yêu cầu để bảo vệ tính xác thực của hồ sơ.</p>

        <h2>8. Spam và thao túng nền tảng</h2>
        <p>Không gửi hàng loạt tin nhắn, tạo tương tác giả, dùng nhiều tài khoản để né hạn chế, tự động hóa trái phép, khai thác lỗi, sửa request hoặc tìm cách truy cập dữ liệu của người khác.</p>

        <h2>9. Báo cáo và chặn</h2>
        <p>Người dùng nên báo cáo nội dung hoặc tài khoản có nguy cơ gây hại và có thể chặn tài khoản khác. Không được lạm dụng công cụ báo cáo, gửi bằng chứng giả hoặc trả đũa người báo cáo.</p>

        <h2>10. Cách Luxy.Love thực thi</h2>
        <p>Tùy mức độ và lịch sử vi phạm, Luxy.Love có thể từ chối hoặc gỡ nội dung, hạn chế hiển thị, khóa tính năng, đình chỉ hoặc vô hiệu tài khoản. Nội dung nghiêm trọng có thể được giữ phục vụ điều tra và nghĩa vụ pháp lý.</p>

        <p className="legalUpdated">Hãy sử dụng Luxy.Love với sự tôn trọng, trung thực và đồng thuận; không tạo áp lực tài chính hoặc quan hệ đối với người khác.</p>
      </article>
    </main>
  );
}
