import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tiêu chuẩn cộng đồng',
  description: 'Tiêu chuẩn cộng đồng áp dụng cho hồ sơ, Hoạt động, Album và tin nhắn trên MyFan.',
  alternates: { canonical: '/community-standards' },
};

export default function Page() {
  return (
    <main className="legalPage">
      <article className="legalDocument">
        <p className="legalKicker">MYFAN · CẬP NHẬT NGÀY 31/07/2026</p>
        <h1>Tiêu chuẩn cộng đồng</h1>
        <p className="legalLead">
          Tiêu chuẩn này áp dụng cho hồ sơ, ảnh, Hoạt động, Album, liên kết, quà tặng, tin
          nhắn và mọi nội dung hoặc hành vi trên MyFan.
        </p>

        <h2>1. Chỉ dành cho người từ đủ 18 tuổi</h2>
        <p>
          MyFan không cho phép người dưới 18 tuổi đăng ký hoặc sử dụng nền tảng. Cấm tuyệt đối
          nội dung hoặc hành vi bóc lột, dụ dỗ, xâm hại, tình dục hóa hoặc khai thác người dưới
          18 tuổi dưới bất kỳ hình thức nào.
        </p>
        <p>
          Tài khoản có dấu hiệu không đủ tuổi, sử dụng danh tính của người khác hoặc tìm cách
          tiếp cận người chưa thành niên có thể bị hạn chế ngay để kiểm tra.
        </p>

        <h2>2. Không cho phép nội dung tình dục</h2>
        <p>MyFan không cho phép:</p>
        <ul>
          <li>Khỏa thân, hành vi tình dục hoặc nội dung khiêu dâm.</li>
          <li>Nội dung được trình bày chủ yếu nhằm kích dục.</li>
          <li>Dịch vụ tình dục, mại dâm, môi giới hoặc quảng cáo liên quan.</li>
          <li>Hình ảnh thân mật không có sự đồng thuận, deepfake tình dục hoặc sextortion.</li>
          <li>Yêu cầu chuyển nội dung tình dục qua nền tảng khác.</li>
        </ul>

        <h2>3. Không đổi quà lấy quan hệ hoặc dịch vụ</h2>
        <p>
          Không được đề nghị, yêu cầu hoặc ám chỉ rằng quà tặng, ❤️ hoặc tiền sẽ được đổi lấy
          gặp mặt, hẹn hò, tình cảm, quan hệ tình dục, thông tin liên hệ riêng, dịch vụ cá nhân
          hoặc nội dung người lớn.
        </p>
        <p>
          Quà tặng số chỉ thể hiện sự ủng hộ đối với Creator và cộng đồng. Quà không tạo nghĩa
          vụ cá nhân giữa người tặng và người nhận.
        </p>

        <h2>4. Tôn trọng và không quấy rối</h2>
        <p>Không cho phép các hành vi sau:</p>
        <ul>
          <li>Đe dọa, bắt nạt, làm nhục, ép buộc hoặc theo dõi người khác.</li>
          <li>Gửi tin nhắn lặp lại sau khi người nhận từ chối hoặc đã chặn.</li>
          <li>Kêu gọi tấn công, báo cáo hàng loạt hoặc làm lộ thông tin cá nhân.</li>
          <li>Phân biệt đối xử hoặc kích động thù ghét đối với cá nhân hay nhóm người.</li>
          <li>Nội dung bạo lực nghiêm trọng hoặc cổ vũ gây tổn hại ngoài đời thực.</li>
        </ul>

        <h2>5. Không lừa đảo hoặc mạo danh</h2>
        <p>
          Cấm giả danh cá nhân, Creator, nhân viên MyFan hoặc tổ chức khác; tạo hồ sơ gây hiểu
          nhầm; lừa lấy ❤️, tiền, tài khoản hoặc dữ liệu cá nhân; phát tán liên kết độc hại;
          thao túng tiến độ Fan hoặc giao dịch quà tặng.
        </p>

        <h2>6. Bảo vệ quyền riêng tư</h2>
        <p>
          Không đăng số điện thoại, địa chỉ, tọa độ chính xác, tài liệu định danh, tài khoản
          ngân hàng, nội dung riêng tư hoặc thông tin nhạy cảm của người khác khi chưa được
          phép.
        </p>
        <p>
          Không tìm cách suy luận vị trí chính xác từ khoảng cách gần đúng, vượt qua quyền xem
          Công khai, Bạn bè hoặc Chỉ Fan, hoặc chia sẻ lại nội dung riêng tư ngoài phạm vi được
          Creator lựa chọn.
        </p>

        <h2>7. Hoạt động, Album và liên kết</h2>
        <p>
          Bài Hoạt động phải có nội dung chữ và chỉ được dùng các dạng đang được MyFan hỗ trợ.
          Ảnh, liên kết video và nội dung liên quan phải tuân thủ cùng một tiêu chuẩn kiểm
          duyệt, dù được đặt ở mức Công khai, Bạn bè hay Chỉ Fan.
        </p>
        <p>
          Không dùng liên kết để dẫn tới nội dung bị cấm, trang lừa đảo, tải mã độc, thu thập
          dữ liệu trái phép hoặc né tránh kiểm duyệt của MyFan.
        </p>

        <h2>8. Spam và thao túng nền tảng</h2>
        <p>
          Không gửi hàng loạt lời mời hoặc tin nhắn, tạo tương tác giả, dùng nhiều tài khoản để
          né hạn chế, tự động hóa trái phép, khai thác lỗi, sửa request hoặc tìm cách truy cập
          dữ liệu của người khác.
        </p>

        <h2>9. Báo cáo, chặn và hợp tác kiểm tra</h2>
        <p>
          Người dùng nên báo cáo nội dung hoặc tài khoản có nguy cơ gây hại và có thể chặn tài
          khoản khác. Không được lạm dụng công cụ báo cáo, gửi bằng chứng giả hoặc trả đũa người
          báo cáo.
        </p>

        <h2>10. Cách MyFan thực thi</h2>
        <p>
          Tùy mức độ và lịch sử vi phạm, MyFan có thể từ chối hoặc gỡ nội dung, hạn chế hiển
          thị, khóa một tính năng, đóng băng giao dịch, đình chỉ hoặc xóa tài khoản. Nội dung
          nghiêm trọng có thể được giữ phục vụ điều tra và xử lý theo nghĩa vụ pháp lý.
        </p>
        <p>
          Việc một nội dung từng được duyệt không ngăn MyFan xem xét lại khi có báo cáo mới,
          thay đổi bối cảnh hoặc phát hiện rủi ro trước đó chưa được nhận diện.
        </p>

        <p className="legalUpdated">
          Hãy sử dụng MyFan để xây dựng cộng đồng tích cực, tôn trọng ranh giới và không tạo áp
          lực tài chính hoặc quan hệ đối với người khác.
        </p>
      </article>
    </main>
  );
}
