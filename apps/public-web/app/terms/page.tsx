import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng',
  description: 'Điều khoản sử dụng nền tảng Social Creator 18+ MyFan.',
  alternates: { canonical: '/terms' },
};

export default function Page() {
  return (
    <main className="legalPage">
      <article className="legalDocument">
        <p className="legalKicker">MYFAN · CẬP NHẬT NGÀY 31/07/2026</p>
        <h1>Điều khoản sử dụng</h1>
        <p className="legalLead">
          Điều khoản này quy định việc truy cập và sử dụng MyFan, một mạng xã hội Social
          Creator chỉ dành cho người dùng từ đủ 18 tuổi trở lên.
        </p>

        <h2>1. Điều kiện sử dụng</h2>
        <p>
          Bạn phải từ đủ 18 tuổi, cung cấp thông tin đăng ký chính xác và tự chịu trách nhiệm
          bảo vệ tài khoản của mình. Không được cho người dưới 18 tuổi sử dụng tài khoản hoặc
          dùng thông tin sai để vượt qua bước xác minh độ tuổi.
        </p>

        <h2>2. Mục đích của MyFan</h2>
        <p>
          MyFan cho phép người dùng tạo hồ sơ, khám phá Creator, kết bạn, trò chuyện sau khi
          kết bạn, đăng Hoạt động và ủng hộ Creator bằng quà tặng số.
        </p>
        <p>
          MyFan không phải dịch vụ hẹn hò có bồi hoàn, chuyển tiền ngang hàng, môi giới dịch vụ
          tình dục hoặc nền tảng đổi quà lấy gặp mặt, tình cảm, thông tin liên hệ riêng hay nội
          dung người lớn.
        </p>

        <h2>3. Hồ sơ, Hoạt động và quyền riêng tư</h2>
        <p>
          Người dùng chịu trách nhiệm về nội dung đã đăng. Creator có thể chọn người được xem
          toàn bộ Hoạt động và Album lấy từ Hoạt động theo ba mức: Công khai, Bạn bè hoặc Chỉ
          Fan. Quyền chặn giữa hai tài khoản được ưu tiên hơn các mức quyền này.
        </p>
        <p>
          Thông tin như ngày sinh đầy đủ, tọa độ chính xác, hồ sơ KYC, tài khoản ngân hàng và
          dữ liệu kiểm duyệt nội bộ không phải dữ liệu hồ sơ công khai.
        </p>

        <h2>4. Kết bạn và trò chuyện</h2>
        <p>
          Trong phiên bản hiện tại, chỉ những tài khoản đã chấp nhận kết bạn mới có thể trò
          chuyện. Người dùng không được gửi spam, quấy rối, lừa đảo, mạo danh, đe dọa hoặc sử
          dụng tin nhắn để trao đổi dịch vụ bị cấm.
        </p>

        <h2>5. ❤️ và quà tặng số</h2>
        <p>
          ❤️ là giá trị ảo được sử dụng bên trong MyFan để gửi quà tặng số. Số dư ❤️ đã mua
          không phải tiền gửi ngân hàng, không phải tiền điện tử và người mua không được rút
          trực tiếp thành tiền mặt.
        </p>
        <p>
          Việc tặng quà không tạo nghĩa vụ cho Creator phải gặp mặt, cung cấp thông tin liên hệ,
          duy trì quan hệ cá nhân, cung cấp dịch vụ hoặc đăng nội dung theo yêu cầu của người
          tặng.
        </p>

        <h2>6. Phần thưởng Creator</h2>
        <p>
          Creator đủ điều kiện có thể được ghi nhận phần thưởng theo chính sách hiện hành của
          MyFan. Việc rút tiền yêu cầu hoàn thành KYC, tài khoản ngân hàng hợp lệ, thời gian giữ
          cần thiết và quy trình kiểm tra hoặc phê duyệt của nền tảng.
        </p>

        <h2>7. Nội dung và hành vi bị cấm</h2>
        <p>Người dùng không được đăng hoặc thực hiện các nội dung, hành vi sau:</p>
        <ul>
          <li>Nội dung tình dục, khỏa thân, dịch vụ tình dục hoặc nội dung nhằm kích dục.</li>
          <li>Nội dung liên quan đến bóc lột, dụ dỗ hoặc tình dục hóa người dưới 18 tuổi.</li>
          <li>Đổi quà, ❤️ hoặc tiền lấy gặp mặt, tình cảm, quan hệ tình dục hoặc nội dung người lớn.</li>
          <li>Quấy rối, theo dõi, đe dọa, mạo danh, lừa đảo hoặc thao túng tài chính.</li>
          <li>Đăng thông tin riêng tư của người khác khi chưa được phép.</li>
          <li>Tìm cách vượt qua kiểm duyệt, quyền riêng tư, RLS hoặc các biện pháp an toàn.</li>
        </ul>

        <h2>8. Kiểm duyệt và xử lý vi phạm</h2>
        <p>
          MyFan có thể kiểm tra, hạn chế hiển thị, gỡ bỏ hoặc lưu trữ nội dung; hạn chế tính
          năng; đóng băng giao dịch; đình chỉ hoặc xóa tài khoản khi cần bảo vệ người dùng,
          điều tra vi phạm, tuân thủ pháp luật hoặc thực thi Tiêu chuẩn cộng đồng.
        </p>

        <h2>9. Báo cáo và chặn</h2>
        <p>
          Người dùng có thể báo cáo tài khoản, ảnh, Hoạt động, liên kết hoặc tin nhắn và có thể
          chặn tài khoản khác. Báo cáo sai sự thật, lạm dụng công cụ báo cáo hoặc trả đũa người
          báo cáo đều có thể bị xử lý.
        </p>

        <h2>10. Xóa tài khoản</h2>
        <p>
          Người dùng có thể gửi yêu cầu xóa tài khoản trong ứng dụng. Một số dữ liệu có thể
          được giữ trong thời hạn cần thiết để xử lý giao dịch, nghĩa vụ pháp lý, chống gian lận
          hoặc thực thi an toàn trước khi được xóa hoặc ẩn danh theo quy trình hệ thống.
        </p>

        <h2>11. Thay đổi điều khoản</h2>
        <p>
          MyFan có thể cập nhật Điều khoản khi sản phẩm, pháp luật hoặc yêu cầu vận hành thay
          đổi. Khi cần, người dùng sẽ được yêu cầu đọc và chấp nhận phiên bản mới trước khi tiếp
          tục sử dụng các tính năng được bảo vệ.
        </p>

        <p className="legalUpdated">
          Việc tiếp tục sử dụng MyFan sau khi Điều khoản có hiệu lực đồng nghĩa với việc bạn
          đồng ý tuân thủ Điều khoản và Tiêu chuẩn cộng đồng hiện hành.
        </p>
      </article>
    </main>
  );
}
