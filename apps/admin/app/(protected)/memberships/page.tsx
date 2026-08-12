import { MembershipAdmin } from './membership-admin';

export default function Page() {
  return (
    <section className="card">
      <h1>Gói thành viên</h1>
      <p>Đối soát thủ công Premium / Diamond. Thanh toán không tự mở quyền; chỉ Finance Admin hoặc Super Admin xác nhận đúng số tiền mới kích hoạt gói.</p>
      <MembershipAdmin />
    </section>
  );
}
