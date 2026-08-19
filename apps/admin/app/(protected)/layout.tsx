import Link from 'next/link';
import { ProtectedShell } from './protected-shell';

const links = [
  ['Dashboard', '/dashboard'],
  ['Homepage', '/homepage'],
  ['Users', '/users'],
  ['Xác minh ảnh', '/member-verifications'],
  ['Gói thành viên', '/memberships'],
  ['Gifts', '/gifts'],
  ['Payments', '/payments'],
  ['Đối soát VietQR', '/vietqr-reconciliation'],
  ['Withdrawals', '/withdrawals'],
  ['KYC & rút tiền', '/kyc-withdrawal-operations'],
  ['Moderation', '/moderation'],
  ['Observability', '/runtime-observability'],
] as const;

export default function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProtectedShell>
      <div className="shell">
        <nav aria-label="Admin navigation">
          <strong>Chon.Love Admin</strong>
          {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <main>{children}</main>
      </div>
    </ProtectedShell>
  );
}
