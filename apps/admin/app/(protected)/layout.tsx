import Link from 'next/link';

const links = [
  ['Dashboard', '/dashboard'],
  ['Users', '/users'],
  ['Gifts', '/gifts'],
  ['Payments', '/payments'],
  ['Withdrawals', '/withdrawals'],
  ['Moderation', '/moderation'],
  ['Observability', '/runtime-observability'],
] as const;

export default function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="shell">
      <nav aria-label="Admin navigation">
        <strong>MyFan Admin</strong>
        {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
      <main>{children}</main>
    </div>
  );
}
