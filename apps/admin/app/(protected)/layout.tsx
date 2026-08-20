import Link from 'next/link';

const links = [
  ['Dashboard', '/dashboard'],
  ['Homepage', '/homepage'],
  ['Users', '/users'],
  ['Xác minh ảnh', '/member-verifications'],
  ['Gói thành viên', '/memberships'],
  ['Đối soát VietQR', '/vietqr-reconciliation'],
  ['KYC & rút tiền', '/withdrawals'],
  ['Moderation', '/moderation'],
  ['Observability', '/runtime-observability'],
] as const;

export default function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="shell">
      <nav aria-label="Admin navigation">
        <strong>Chon.Love Admin</strong>
        {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
      <main>{children}</main>
    </div>
  );
}
