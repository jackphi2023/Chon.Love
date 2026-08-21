import { AdminShell } from './admin-shell';

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
  return <AdminShell links={links}>{children}</AdminShell>;
}
