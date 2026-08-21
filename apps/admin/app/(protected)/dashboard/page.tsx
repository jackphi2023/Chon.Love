import Link from 'next/link';

const modules = [
  {
    title: 'Thành viên',
    description: 'Tìm kiếm hồ sơ, kiểm tra trạng thái tài khoản, tạm khóa/vô hiệu và quản lý discovery với audit.',
    href: '/users',
    action: 'Quản trị thành viên',
  },
  {
    title: 'Xác minh ảnh',
    description: 'Rà soát selfie và trạng thái xác minh thành viên trước khi xử lý các trường hợp cần can thiệp.',
    href: '/member-verifications',
    action: 'Mở hàng chờ xác minh',
  },
  {
    title: 'Gói thành viên',
    description: 'Quản lý nghiệp vụ Premium/Diamond và các trạng thái membership đang được vận hành.',
    href: '/memberships',
    action: 'Quản lý membership',
  },
  {
    title: 'VietQR',
    description: 'Đối soát giao dịch theo luồng BR-07. Các settlement flag production vẫn fail-closed cho đến khi phát hành.',
    href: '/vietqr-reconciliation',
    action: 'Mở đối soát',
  },
  {
    title: 'KYC & rút tiền',
    description: 'Luồng maker-checker cho KYC/payout. Withdrawal production hiện vẫn được khóa ở backend.',
    href: '/withdrawals',
    action: 'Mở vận hành KYC',
  },
  {
    title: 'Moderation',
    description: 'Xử lý report và nội dung cần kiểm duyệt; thao tác nhạy cảm tiếp tục được kiểm tra quyền ở backend.',
    href: '/moderation',
    action: 'Mở moderation',
  },
] as const;

export default function Page() {
  return (
    <section className="adminDashboardPage">
      <header className="adminPageHeader">
        <div>
          <p className="adminEyebrow">DASHBOARD</p>
          <h1>Vận hành Chọn.Love</h1>
          <p>Truy cập nhanh các module quản trị đang hoạt động. Chỉ session Admin tách biệt có role <strong>super_admin</strong> mới được phép vào khu vực này.</p>
        </div>
        <div className="adminStatusPanel">
          <span className="adminStatusDot" />
          <div><strong>Admin boundary</strong><small>Fail-closed · Backend re-check</small></div>
        </div>
      </header>

      <div className="adminDashboardGrid">
        {modules.map((module) => (
          <article className="adminModuleCard" key={module.href}>
            <div>
              <h2>{module.title}</h2>
              <p>{module.description}</p>
            </div>
            <Link className="adminModuleLink" href={module.href}>{module.action}<span aria-hidden="true">→</span></Link>
          </article>
        ))}
      </div>

      <section className="adminReleaseNotice" aria-label="Trạng thái phát hành tài chính">
        <div>
          <p className="adminEyebrow">PRODUCTION SAFETY</p>
          <h2>Gift / Withdrawal / VietQR settlement đang khóa</h2>
        </div>
        <p>Admin có thể chuẩn bị và rà soát nghiệp vụ, nhưng các capability tài chính chưa phát hành vẫn bị khóa bằng server-side feature flags và quyền RPC.</p>
      </section>
    </section>
  );
}
