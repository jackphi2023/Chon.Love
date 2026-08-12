import { MemberVerificationAdmin } from './member-verification-admin';

export default function Page() {
  return (
    <section className="card">
      <h1>Xác minh ảnh thành viên</h1>
      <p>Review các tài khoản selfie không đạt auto-verify. Admin chỉ có thể duyệt hoặc ẩn tài khoản; mọi quyết định được ghi audit log.</p>
      <MemberVerificationAdmin />
    </section>
  );
}
