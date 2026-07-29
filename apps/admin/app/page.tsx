import Link from 'next/link';

export default function LoginPage() {
  return (
    <main>
      <div className="card">
        <h1>MyFan Admin</h1>
        <p>Login placeholder. Supabase Auth và RBAC server-side sẽ được triển khai ở các phiên sau.</p>
        <Link href="/dashboard">Mở dashboard skeleton</Link>
      </div>
    </main>
  );
}
