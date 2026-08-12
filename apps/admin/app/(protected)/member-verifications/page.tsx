import { MemberVerificationAdmin } from './member-verification-admin';
import { ProfileVerificationAdmin } from './profile-verification-admin';

export default function Page() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section className="card">
        <h1>Xác thực thành viên</h1>
        <p>Review Selfie, CCCD và LinkedIn. Chỉ trạng thái badge được công khai; ảnh selfie/CCCD dùng signed URL ngắn hạn và mọi quyết định đều ghi audit log.</p>
      </section>

      <section className="card">
        <h2>Selfie + ảnh hồ sơ</h2>
        <p>Hàng chờ dành cho selfie không đạt auto-verify trên ngưỡng 60%. Admin có thể duyệt kích hoạt hoặc ẩn/vô hiệu tài khoản.</p>
        <MemberVerificationAdmin />
      </section>

      <section className="card">
        <h2>CCCD + LinkedIn</h2>
        <p>CCCD là xác thực danh tính hồ sơ Luxy, tách khỏi payout KYC. LinkedIn là tín hiệu nghề nghiệp bổ sung; hệ thống không nhận mật khẩu LinkedIn.</p>
        <ProfileVerificationAdmin />
      </section>
    </div>
  );
}
